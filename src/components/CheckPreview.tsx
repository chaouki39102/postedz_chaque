import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Printer, Eye, Sparkles, Move, Lock, Unlock, RotateCcw, Bookmark, Pencil, X } from 'lucide-react';
import { numberToArabicWords, numberToFrenchWords, validateNumber } from '../utils/numberToWords';
import { formatDateNumeric } from '../utils/date';
import { CHECK_FIELDS } from '../types';
import { useLabelProxy } from '../context/labelsCore';
import { loadPreference, savePreference } from '../utils/storage';
import { patchPosition } from '../utils/positions';
import {
  printCheck,
  clampFontCqw,
  clampWidthPercent,
  MIN_WIDTH_PERCENT,
  MAX_WIDTH_PERCENT,
  FIELD_LAYOUT,
  type PrintedField,
  type PrintLayout,
} from '../utils/printCheck';
import type { CheckData, Position, PositionMap, Language, Bank, Preset } from '../types';

/** العناصر القابلة للسحب على الشيك */
type FieldId = (typeof CHECK_FIELDS)[number];

/** نستخدم أسماء الحقول نفسها كمعرّفات، مع الاحتفاظ بالأنواع */
const FIELD = {
  date: 'date',
  place: 'place',
  beneficiary: 'beneficiary',
  amount: 'amount',
  amountWords: 'amountWords',
} as const satisfies Record<FieldId, FieldId>;

/** العناصر المحاذاة لليمين بدل اليسار: مصدر واحد مع مستند الطباعة */
const isRightAligned = (field: FieldId): boolean => FIELD_LAYOUT[field].rightAligned;

/** حدود حركة السحب (نسبة مئوية) */
const MIN_OFFSET = -100;
const MAX_OFFSET = 200;

/** عرض ورقة الشيك الحقيقي 210mm بالبكسل عند 96dpi (نسبة CSS) */
const PRINT_WIDTH_PX = (210 * 96) / 25.4;

/** تفضيل: طباعة الحقول فقط دون صورة البنك (الشيك في الطابعة فارغ) */
const PRINT_TEXT_ONLY_KEY = 'print_text_only';

/**
 * ألوان العناصر قابلة للتحليل (scannable) بواسطة Tailwind.
 * لا تستخدم أسماء أصناف ديناميكية مثل `bg-${color}-100` لأن Tailwind
 * لا يولّدها وقت البناء فتختفي كل التنسيقات بصمت.
 */
const FIELD_THEME: Record<FieldId, { hover: string; active: string; badge: string }> = {
  [FIELD.date]: {
    hover: 'hover:bg-blue-100/70 hover:border-blue-500 dark:hover:bg-blue-900/30',
    active: 'bg-blue-200/80 dark:bg-blue-800/50 border-2 border-blue-600 dark:border-blue-400',
    badge: 'text-blue-600 dark:text-blue-400',
  },
  [FIELD.place]: {
    hover: 'hover:bg-green-100/70 hover:border-green-500 dark:hover:bg-green-900/30',
    active: 'bg-green-200/80 dark:bg-green-800/50 border-2 border-green-600 dark:border-green-400',
    badge: 'text-green-600 dark:text-green-400',
  },
  [FIELD.beneficiary]: {
    hover: 'hover:bg-purple-100/70 hover:border-purple-500 dark:hover:bg-purple-900/30',
    active: 'bg-purple-200/80 dark:bg-purple-800/50 border-2 border-purple-600 dark:border-purple-400',
    badge: 'text-purple-600 dark:text-purple-400',
  },
  [FIELD.amount]: {
    hover: 'hover:bg-yellow-100/70 hover:border-yellow-500 dark:hover:bg-yellow-900/30',
    active: 'bg-yellow-200/80 dark:bg-yellow-800/50 border-2 border-yellow-600 dark:border-yellow-400',
    badge: 'text-yellow-600 dark:text-yellow-400',
  },
  [FIELD.amountWords]: {
    hover: 'hover:bg-orange-100/70 hover:border-orange-500 dark:hover:bg-orange-900/30',
    active: 'bg-orange-200/80 dark:bg-orange-800/50 border-2 border-orange-600 dark:border-orange-400',
    badge: 'text-orange-600 dark:text-orange-400',
  },
};

const formatCurrency = (num: number): string =>
  num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

interface CheckPreviewProps {
  checkData: CheckData;
  positions: PositionMap;
  setPositions: (updater: (current: PositionMap) => PositionMap) => void;
  language: Language;
  bank: Bank;
  isLocked: boolean;
  onToggleLock: () => void;
  onResetPositions: () => void;
  presets: Preset[];
  onApplyPreset: (preset: Preset) => void;
  onDeletePreset: (id: string) => void;
  onRenamePreset: (preset: Preset, name: string) => void | Promise<void>;
  onPrint?: () => void;
  /** موضع الشيك على الورقة (من واجهة الطباعة) */
  printLayout?: PrintLayout;
}

const CheckPreview: React.FC<CheckPreviewProps> = ({
  checkData,
  positions,
  setPositions,
  language,
  bank,
  isLocked,
  onToggleLock,
  onResetPositions,
  presets,
  onApplyPreset,
  onDeletePreset,
  onRenamePreset,
  onPrint,
  printLayout,
}) => {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draggedElement, setDraggedElement] = useState<FieldId | null>(null);
  const [printTextOnly, setPrintTextOnly] = useState(
    () => loadPreference(PRINT_TEXT_ONLY_KEY) === '1'
  );

  const checkRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    field: FieldId;
    startX: number;
    startY: number;
    origin: Position;
  } | null>(null);
  const frameRef = useRef<number | null>(null);

  // النصوص تأتي من جدول labels في قاعدة البيانات (انظر src/data/labelSeeds.ts)
  const currentLabels = useLabelProxy('preview.');

  /**
   * المواضع مؤقتة أثناء السحب في ref بدل state، لتجنّب إعادة ربط
   * مستمعي mousemove على كل حركة مؤشر.
   */
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  const dateText = useMemo(() => formatDateNumeric(checkData.date), [checkData.date]);

  const amountInWords = useMemo(() => {
    const amount = Number(checkData.amount);
    if (!checkData.amount || !validateNumber(amount)) return '';
    return language === 'ar' ? numberToArabicWords(amount) : numberToFrenchWords(amount);
  }, [checkData.amount, language]);

  const amountNumeric = useMemo(() => {
    const amount = Number(checkData.amount);
    return checkData.amount && validateNumber(amount) ? formatCurrency(amount) : '';
  }, [checkData.amount]);

  const amountIsUnsupported = useMemo(() => {
    if (!checkData.amount) return false;
    return !validateNumber(Number(checkData.amount));
  }, [checkData.amount]);

  const commitDragPosition = useCallback(
    (field: FieldId, x: number, y: number) => {
      setPositions((current) => ({
        ...current,
        [field]: { ...current[field], x, y },
      }));
    },
    [setPositions]
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent, field: FieldId) => {
      if (isLocked) return;

      event.preventDefault();
      event.stopPropagation();

      if (!checkRef.current) return;

      dragStateRef.current = {
        field,
        startX: event.clientX,
        startY: event.clientY,
        origin: { ...(positionsRef.current[field] ?? { x: 0, y: 0 }) },
      };
      setDraggedElement(field);

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
    },
    [isLocked]
  );

  const stopDragging = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    dragStateRef.current = null;
    setDraggedElement(null);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, []);

  useEffect(() => {
    if (!draggedElement) return;

    const handleMouseMove = (event: MouseEvent) => {
      const drag = dragStateRef.current;
      const container = checkRef.current;
      if (!drag || !container) return;

      event.preventDefault();

      // نؤجل الاستدعاء إلى الإطار التالي لتقليل إعادة الرسم
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const rect = container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        let deltaX = ((event.clientX - drag.startX) / rect.width) * 100;
        const deltaY = ((event.clientY - drag.startY) / rect.height) * 100;

      // العناصر المحاذاة لليمين تتحرك عكسياً
      if (isRightAligned(drag.field)) deltaX = -deltaX;

        commitDragPosition(
          drag.field,
          Math.round(clamp(drag.origin.x + deltaX, MIN_OFFSET, MAX_OFFSET)),
          Math.round(clamp(drag.origin.y + deltaY, MIN_OFFSET, MAX_OFFSET))
        );
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDragging);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDragging);
    };
  }, [draggedElement, commitDragPosition, stopDragging]);

  // تنظيف عند إزالة المكوّن أثناء السحب
  useEffect(() => stopDragging, [stopDragging]);

  /*
   * قياسات الطباعة الاحتياطية (زر المتصفح): العرض الحالي للمعاينة
   * بالبكسل + معامل التكبير الذي يجعله 210mm على الورقة.
   *
   * الفكرة: تخطيط الطباعة = تخطيط المعاينة بالبكسل تماماً (نفس حجم
   * الخط بـ cqw، نفس الحشو، نفس العرض المحدد) ثم تكبير بصري إلى
   * 210mm. لو فرضنا 210mm على التخطيط مباشرة لاختلف تقريب عرض كل
   * حرف قليلاً فيقفز نص المبلغ بالحروف من ثلاثة أسطر إلى سطرين.
   */
  useEffect(() => {
    const box = checkRef.current;
    if (!box) return;

    const update = () => {
      /*
       * clientWidth هو عرض التخطيط، لا العرض البصري بعد transform.
       * قياس getBoundingClientRect في وسائط الطباعة يقرأ العرض
       * المكبَّر فيحسب المعامل خطأً ويساوي واحداً.
       */
      const width = box.clientWidth;
      if (width <= 0) return;
      box.style.setProperty('--print-w', `${width}px`);
      box.style.setProperty('--print-h', `${(width * 99) / 210}px`);
      box.style.setProperty('--print-k', String(PRINT_WIDTH_PX / width));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const renderDraggableElement = (
    field: FieldId,
    value: string,
    position: Position
  ) => {
    if (!value) return null;

    const theme = FIELD_THEME[field];
    const isRightAlignedField = isRightAligned(field);
    const isActive = draggedElement === field;
    const isWrapping = FIELD_LAYOUT[field].wrapping;

    return (
      <div
        className={[
          // حجم الخط يأتي من style المقياس cqw، لذا نزيل text-sm الذي يُلغي
          // التتام مع الأساس ويستخدم حجماً ثابتاً بالبكسل
          'absolute font-bold text-black select-none',
          'transition-all duration-200 rounded-lg print-text',
          /*
           * المبلغ بالحروف: بدون حشو أفقي إطلاقاً.
           * الحشو كان يسرق مساحة من العرض المحدد، فيقلّ الالتفاف في
           * المعاينة عن الطباعة (لأن box-sizing يشمل الحشو داخل العرض).
           * التمييز البصري يأتي من لون الخلفية عند التحويم، ولا يؤثر على التخطيط.
           */
          isWrapping
            ? 'py-1'
            : 'px-3 py-1.5 drop-shadow-sm',
          isLocked ? 'cursor-default' : `cursor-grab ${theme.hover}`,
          isActive ? `${theme.active} shadow-lg z-50` : '',
        ].filter(Boolean).join(' ')}
        style={{
          [isRightAlignedField ? 'right' : 'left']: `${position.x}%`,
          top: `${position.y}%`,
          transform: `translate(${isRightAlignedField ? '50%' : '-50%'}, -50%)`,
          fontFamily: 'Cairo, sans-serif',
          /*
           * أحجام الخطوط بوحدة cqw (1% من عرض الشيك) لا بوحدة px.
           * هذا هو مفتاح تطابق المعاينة مع الطباعة: العرض متطابق (210mm)
           * وحجم الخط نسبي لعرض الشيك نفسه، فيتمدد النص وينكمش بنفس النسبة
           * فيصحّ عدد الأسطر في الحالتين. بوحدة px ينكمش النص على الشاشة
           * الصغيرة فيناسب سطراً أكثر مما يناسب في الطباعة.
           *
           * 11pt ÷ 210mm ≈ 1.848% من عرض الشيك.
           */
          /*
           * الأحجام من نفس وحدة الطباعة (src/utils/printCheck.ts): قيمة
           * واحدة تكفي المعاينة والمطبوع فلا يختلف أحدهما عن الآخر.
           * و`fontCqw` من مواضع الحقل: ما يضبطه المستخدم في تبويب
           * الخطوط يظهر هنا وفي المستند المطبوع بنفس القيمة، وغيابه
           * يعود إلى الحجم الافتراضي لهذا الحقل.
           */
          fontSize: `${clampFontCqw(position.fontCqw, isWrapping)}cqw`,
          ...(isWrapping
            ? {
                // عرض صريح إجباري: بدونه ينكمش العنصر على محتواه ولا يلتف أبداً
                width: `${clampWidthPercent(position.widthPercent)}%`,
                maxWidth: `${clampWidthPercent(position.widthPercent)}%`,
                whiteSpace: 'normal',
                overflowWrap: 'break-word',
                lineHeight: 1.15,
              }
            : { whiteSpace: 'nowrap' }),
        }}
        onMouseDown={(event) => handleMouseDown(event, field)}
        title={isLocked ? currentLabels.lockedTitle : currentLabels.dragTitle}
      >
        {!isLocked && (
          <Move
            className={`w-3 h-3 ${theme.badge} absolute -top-1 -right-1 opacity-60 transition-opacity no-print`}
          />
        )}
        {value}
      </div>
    );
  };

  const positionFor = (field: FieldId): Position => positions[field] ?? { x: 0, y: 0 };

  const amountWordsWidth = clampWidthPercent(positions.amountWords?.widthPercent);

  const setAmountWordsWidth = (percent: number) => {
    setPositions((current) =>
      patchPosition(current, 'amountWords', { widthPercent: clampWidthPercent(percent) })
    );
  };

  /*
   * الطباعة في نافذة مستقلة (src/utils/printCheck.ts): صفحة الشيك
   * وحدها، بمقاسها الحقيقي 210×99mm وبنفس مواضع المعاينة.
   *
   * `window.open` تُستدعى فوراً من معالج النقر: النافذة المنبثقة تحتاج
   * فعل المستخدم، وأي انتظار قبلها يجعل المتصفح يحجبها. أما
   * `window.print()` من الصفحة نفسها فتبقى مساراً احتياطياً (@media
   * print في index.css) لمن يطبع من المتصفح مباشرة بـ Ctrl+P.
   */
  const handlePrint = () => {
    /*
     * نفس الحقول ونفس قواعد الالتفاف والمحاذاة التي ترسمها المعاينة،
     * حتى لا يختلف المطبوع عن المعروض.
     */
    const fields: PrintedField[] = (
      [
        [FIELD.date, dateText],
        [FIELD.place, checkData.place],
        [FIELD.beneficiary, checkData.beneficiary],
        [FIELD.amount, amountNumeric],
        [FIELD.amountWords, amountInWords],
      ] as const
    ).map(([field, value]) => ({
      value,
      position: positionFor(field),
      ...FIELD_LAYOUT[field],
    }));

    const result = printCheck({
      title: currentLabels.printTitle,
      language,
      imageUrl: printTextOnly ? null : bank.imageUrl,
      fields,
      layout: printLayout,
    });

    /* المتصفح حظر النافذة: لا يطبع شيء، ونخبر المستخدم بدل الصمت */
    if (!result.ok) {
      window.alert(currentLabels.popupBlocked);
      return;
    }

    onPrint?.();
  };

  return (
    <div className="bg-white/90 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover-lift transition-shadow hover:shadow-xl">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-5 py-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-1.5 rounded-lg">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">{currentLabels.preview}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onToggleLock}
              aria-pressed={isLocked}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all duration-300 font-medium text-sm backdrop-blur-sm border border-white/20 hover:scale-105 ${
                isLocked
                  ? 'bg-red-500/90 text-white hover:bg-red-600'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
              }`}
            >
              {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              <span>{isLocked ? currentLabels.locked : currentLabels.unlocked}</span>
            </button>
            <button
              type="button"
              onClick={onResetPositions}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-300 font-medium text-sm backdrop-blur-sm border border-white/20 hover:scale-105"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{currentLabels.reset}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all duration-300 font-medium text-sm backdrop-blur-sm border border-white/20 hover:scale-105"
            >
              <Printer className="w-4 h-4" />
              <span>{currentLabels.print}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div
          ref={checkRef}
          id="check-preview"
          className={`relative mx-auto rounded-xl overflow-hidden shadow-md border border-gray-300 dark:border-gray-600${
            printTextOnly ? ' print-hide-image' : ''
          }`}
          style={{
            /*
             * العرض معياري: 210mm وهو نفس بُعد ورقة الشيك في الطباعة.
             *
             * كان العرض سائلاً (w-full)، فكان يختلف بين شاشة ومعاينة
             * وطباعة: نسبة العرض نفسها تحوي عدداً مختلفاً من الحروف،
             * فيخرج عدد الأسطر مختلفاً بين المعاينة والطباعة.
             *
             * `containerType: inline-size` يجعل وحدة cqw تساوي 1% من
             * عرض الشيك، فتُحسب أحجام الخطوط بالنسبة نفسها فيظهر
             * الالتفاف متطابقاً على أي مقاس شاشة. وبما أن الطباعة
             * تستخدم نفس العرض (210mm) فهي نفس النسبة تماماً.
             */
            width: 'min(100%, 210mm)',
            aspectRatio: '210 / 99',
            containerType: 'inline-size',
            cursor: draggedElement ? 'grabbing' : 'default',
          }}
        >
          {/*
           * الصورة عنصر <img> لا خلفية CSS.
           *
           * المتصفحات لا تطبع خلفيات CSS إلا بخيار "طباعة الرسومات
           * الخلفية" في حوار الطباعة، وهو خيار معطّل افتراضياً عند
           * كثير من المستخدمين. خلفية CSS تعني شيكاً أبيض عليه الحقول
           * فقط — أي ورقة بلا قيمة. عنصر الصورة يُطبع دائماً.
           */}
          {bank.imageUrl !== null && (
            <img
              src={bank.imageUrl}
              alt=""
              draggable={false}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
            />
          )}

          {renderDraggableElement(FIELD.date, dateText, positionFor(FIELD.date))}
          {renderDraggableElement(FIELD.place, checkData.place, positionFor(FIELD.place))}
          {renderDraggableElement(FIELD.beneficiary, checkData.beneficiary, positionFor(FIELD.beneficiary))}
          {renderDraggableElement(FIELD.amount, amountNumeric, positionFor(FIELD.amount))}
          {renderDraggableElement(FIELD.amountWords, amountInWords, positionFor(FIELD.amountWords))}

          {/* بنك بلا صورة: نص صريح بدل مساحة بيضاء لا يُعرف سببها */}
          {bank.imageUrl === null && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="bg-white/85 dark:bg-gray-900/70 text-gray-500 dark:text-gray-400 text-xs px-3 py-1.5 rounded-lg">
                {currentLabels.noImage}
              </span>
            </div>
          )}

          {draggedElement && (
            <div className="absolute top-4 left-4 bg-black/80 text-white px-3 py-2 rounded-lg text-sm font-medium z-50 no-print">
              {currentLabels.dragIndicator}
            </div>
          )}
        </div>

        {/* التحكم في عرض المبلغ بالحروف — يغيّر الالتفاف مباشرة */}
        <div className="mt-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 p-4 rounded-xl border border-orange-100 dark:border-orange-800 no-print">
          <div className="flex items-center justify-between gap-3 mb-3">
            <label
              htmlFor="amount-words-width"
              className="flex items-center gap-2 text-sm font-bold text-orange-800 dark:text-orange-200"
            >
              <Sparkles className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              {currentLabels.widthControl}
            </label>
            <output
              htmlFor="amount-words-width"
              className="text-sm font-bold text-orange-700 dark:text-orange-300 tabular-nums"
            >
              {amountWordsWidth}%
            </output>
          </div>

          <input
            id="amount-words-width"
            type="range"
            min={MIN_WIDTH_PERCENT}
            max={MAX_WIDTH_PERCENT}
            step={1}
            value={amountWordsWidth}
            onChange={(event) => setAmountWordsWidth(Number(event.target.value))}
            className="w-full accent-orange-500 cursor-pointer"
            aria-describedby="amount-words-width-hint"
          />

          <p
            id="amount-words-width-hint"
            className="mt-2 text-xs text-orange-700 dark:text-orange-300"
          >
            {currentLabels.widthHint}
          </p>
        </div>

        {/* القوالب المحفوظة */}
        <div className="mt-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 no-print">
          <h3 className="flex items-center gap-2 text-sm font-bold text-indigo-800 dark:text-indigo-200 mb-3">
            <Bookmark className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            {currentLabels.presets}
          </h3>

          {presets.length === 0 ? (
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              {currentLabels.noPresets}
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <li
                  key={preset.id}
                  className={`flex items-center rounded-lg overflow-hidden ${
                    renamingId === preset.id ? 'ring-2 ring-indigo-400' : ''
                  }`}
                >
                  {renamingId === preset.id ? (
                    <>
                      <input
                        id={`preset-rename-${preset.id}`}
                        defaultValue={preset.name}
                        autoFocus
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') event.currentTarget.blur();
                          if (event.key === 'Escape') setRenamingId(null);
                        }}
                        onBlur={(event) => {
                          const done = onRenamePreset(preset, event.target.value);
                          setRenamingId(null);
                          void done;
                        }}
                        className="px-2 py-1.5 w-40 text-xs bg-white dark:bg-gray-700 border border-indigo-300 dark:border-indigo-600 focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        aria-label={currentLabels.cancel}
                        className="px-2 py-1.5 bg-gray-500 text-white text-xs hover:bg-gray-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onApplyPreset(preset)}
                        className="px-3 py-1.5 rounded-r-none rounded-l-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors max-w-[14rem] truncate"
                        title={preset.name}
                      >
                        {preset.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(preset.id)}
                        aria-label={`${currentLabels.renamePreset}: ${preset.name}`}
                        className="px-2 py-1.5 bg-indigo-500 text-white text-xs hover:bg-indigo-600 transition-colors border-l border-indigo-400"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeletePreset(preset.id)}
                        aria-label={`${currentLabels.deletePreset}: ${preset.name}`}
                        className="px-2 py-1.5 rounded-l-none rounded-r-lg bg-red-500 text-white text-xs hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* تعليمات السحب */}
        <div className="mt-4 bg-gradient-to-r from-blue-50 to-amber-50 dark:from-blue-900/20 dark:to-amber-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 no-print">
          <div className="flex items-center gap-2 mb-3">
            <Move className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-blue-800 dark:text-blue-200">
              {currentLabels.editMode}
            </h3>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300 font-medium">
            {currentLabels.lockMode}
          </p>
        </div>

        {/* المبلغ بالحروف */}
        <div className="mt-5 no-print">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
            <h3 className="font-bold text-green-800 dark:text-green-200 mb-3 text-sm flex items-center gap-2">
              <div className="bg-green-100 dark:bg-green-900/30 p-1.5 rounded-lg">
                <Sparkles className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              {currentLabels.amountInWords}
            </h3>
            <div className="bg-white/80 dark:bg-gray-700/80 p-3 rounded-lg">
              <p
                className="text-green-700 dark:text-green-300 font-medium text-sm leading-relaxed break-words"
                dir="auto"
              >
                {amountIsUnsupported
                  ? currentLabels.unsupportedAmount
                  : amountInWords || currentLabels.emptyAmount}
              </p>
            </div>
            {amountInWords && !amountIsUnsupported && (
              <div className="mt-3 p-2.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <p className="text-green-800 dark:text-green-200 text-sm font-medium">
                  {currentLabels.autoConvert}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* تحذير الطباعة */}
        <div className="mt-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800 no-print">
          <div className="flex items-center gap-2 mb-3">
            <Printer className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200">
              {currentLabels.printTips}
            </h3>
          </div>
          <div className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
            <p>• {currentLabels.printTip1}</p>
            <p>• {currentLabels.printTip2}</p>
            <p>• {currentLabels.printTip3}</p>
            <p>• {currentLabels.printTip4}</p>
          </div>

          {/*
           * الكتابة فقط: الاستعمال المعتاد شيك فارغ في الطابعة، فنطبع
           * الحقول دون صورة البنك. تفضيل جهاز لا بيانات شيك، فحفظناه
           * محلياً مع بقية تفضيلات العرض.
           */}
          <label className="mt-3 flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200 cursor-pointer">
            <input
              id="print-text-only"
              type="checkbox"
              checked={printTextOnly}
              onChange={(event) => {
                setPrintTextOnly(event.target.checked);
                savePreference(PRINT_TEXT_ONLY_KEY, event.target.checked ? '1' : '0');
              }}
              className="w-4 h-4 accent-amber-600"
            />
            {currentLabels.printTextOnly}
          </label>
        </div>
      </div>
    </div>
  );
};

export default CheckPreview;
