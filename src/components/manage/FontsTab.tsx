import React, { useCallback, useEffect, useState } from 'react';
import { Type, RotateCcw } from 'lucide-react';
import { useLabelProxy, useLabels } from '../../context/labelsCore';
import { useFieldDefaults } from '../../hooks/useFieldDefaults';
import { CHECK_FIELDS, type CheckField, type Language, type PositionMap, type StoredCheckData } from '../../types';
import {
  FIELD_LAYOUT,
  MAX_FONT_CWQ,
  MIN_FONT_CQW,
  clampFontCqw,
  clampWidthPercent,
  cqwToPt,
  defaultFontCqw,
  ptToCqw,
} from '../../utils/printCheck';
import { numberToArabicWords, numberToFrenchWords, validateNumber } from '../../utils/numberToWords';
import { patchPosition } from '../../utils/positions';
import { formatDateNumeric } from '../../utils/date';

/**
 * مدى الضبط بالنقطة على ورق 210mm.
 *
 * نقطة واحدة = 25.4/72 مم، والحدان يقابلان 1 و3.4 cqw مقرّبين إلى
 * نصف نقطة: دون الأول لا يبقى الحقل مقروءاً على شيك 210mm، وفوق
 * الثاني يخرج النص عن إطار الشيك مهما كان موضعه. الوحدة نقطة لا cqw
 * لأن المستخدم يقيس الخط على الورق بالنقاط لا بنسبة من عرض الشيك.
 */
const MIN_FONT_PT = Math.round(cqwToPt(MIN_FONT_CQW) * 2) / 2;
const MAX_FONT_PT = Math.round(cqwToPt(MAX_FONT_CWQ) * 2) / 2;
const FONT_STEP_PT = 0.5;

/** مبلغ تجريبي للنموذج حين لا توجد قيمة افتراضية: رقم يشبه شيكاً حقيقياً */
const SAMPLE_AMOUNT = '1234567.89';

/** ترتيب الحقول كما تظهر على الشيك: من أعلى الورقة إلى أسفلها */
const FONT_FIELDS: ReadonlyArray<{ field: CheckField; labelKey: string }> = [
  { field: 'date', labelKey: 'fontDate' },
  { field: 'place', labelKey: 'fontPlace' },
  { field: 'beneficiary', labelKey: 'fontBeneficiary' },
  { field: 'amount', labelKey: 'fontAmount' },
  { field: 'amountWords', labelKey: 'fontAmountWords' },
];

/** حجم الحقل بالنقطة مقرّباً إلى خانة عشرية: نفس الرقم في الحقل والشريط */
const sizeInPt = (fontCqw: number | undefined, wrapping: boolean): number =>
  Math.round(cqwToPt(clampFontCqw(fontCqw, wrapping)) * 10) / 10;

/**
 * نصوص النموذج: القيم الافتراضية للحقول، واسم الحقل مكانها إن كانت
 * فارغة. غرضها إظهار الحجم لا البيانات، فلا تعبّر عن شيك حقيقي.
 */
const buildSamples = (
  values: StoredCheckData | null,
  language: Language,
  labels: Record<string, string>
): Record<CheckField, string> => {
  const amount = values?.amount ?? '';
  const numeric = Number(amount);
  const amountValid = amount !== '' && validateNumber(numeric);
  const words = language === 'ar' ? numberToArabicWords : numberToFrenchWords;

  return {
    date: values?.date ? formatDateNumeric(values.date) : labels.fontDate,
    place: values?.place || labels.fontPlace,
    beneficiary: values?.beneficiary || labels.fontBeneficiary,
    amount: amountValid
      ? numeric.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : labels.fontAmount,
    amountWords: words(amountValid ? numeric : Number(SAMPLE_AMOUNT)),
  };
};

interface FontsTabProps {
  positions: PositionMap;
  setPositions: (updater: (current: PositionMap) => PositionMap) => void;
}

/**
 * تبويب الخطوط: حجم كل حقل على حدة.
 *
 * الحجم يُحفظ في موضع الحقل لا في تفضيل عام، فيُحفظ لكل بنك ولكل لغة،
 * وينتقل مع القوالب، ويزول مع أمر «إعادة المواضع». وتقرأه المعاينة
 * ومستند الطباعة من الدالة نفسها، فما يظهر في النموذج يظهر على الورقة.
 */
const FontsTab: React.FC<FontsTabProps> = ({ positions, setPositions }) => {
  const currentLabels = useLabelProxy('manage.');
  const { language } = useLabels();
  const { values } = useFieldDefaults(language);

  /*
   * الرقم المكتوب في خانة النقطة يبقى في الشاشة كما تركه المستخدم،
   * والحقل قيد التحرير لا يُعاد ملؤه من المحفوظ: بدون ذلك يمسح
   * التطبيق الرقم أثناء الكتابة كلما تحرّك منزلق حقل آخر.
   */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      let changed = false;

      for (const { field } of FONT_FIELDS) {
        if (editing[field]) continue;
        const pt = String(sizeInPt(positions[field]?.fontCqw, FIELD_LAYOUT[field].wrapping));
        if (next[field] !== pt) {
          next[field] = pt;
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [positions, editing]);

  const setFontPt = useCallback(
    (field: CheckField, pt: number) => {
      const bounded = Math.min(MAX_FONT_PT, Math.max(MIN_FONT_PT, pt));
      setPositions((current) => patchPosition(current, field, { fontCqw: ptToCqw(bounded) }));
    },
    [setPositions]
  );

  const commitDraft = useCallback(
    (field: CheckField, draft: string) => {
      const parsed = Number(draft.replace(',', '.'));
      if (draft.trim() === '' || !Number.isFinite(parsed)) return;
      setFontPt(field, parsed);
    },
    [setFontPt]
  );

  const resetAll = useCallback(() => {
    setPositions((current) => {
      const next = { ...current };
      for (const { field } of FONT_FIELDS) {
        const position = next[field];
        if (position === undefined || position.fontCqw === undefined) continue;
        /*
         * حذف مفتاح الحجم لا تصفيره: الغياب معناه "الحجم الافتراضي"،
         * والصفر ليس قيمة خط بل حقل بلا خط.
         */
        const cleared: PositionMap[string] = { x: position.x, y: position.y };
        if (position.widthPercent !== undefined) cleared.widthPercent = position.widthPercent;
        next[field] = cleared;
      }
      return next;
    });
  }, [setPositions]);

  const samples = buildSamples(values, language, currentLabels);

  return (
    <div className="sp-fonts">
      <div className="sp-fonts__grid">
        <section className="sp-card">
          <header className="sp-card__head">
            <Type className="sp-card__icon" aria-hidden="true" />
            <h3 className="sp-card__title">{currentLabels.fontsTitle}</h3>
          </header>
          <p className="sp-card__hint">{currentLabels.fontsHint}</p>

          {FONT_FIELDS.map(({ field, labelKey }) => {
            const wrapping = FIELD_LAYOUT[field].wrapping;
            const stored = clampFontCqw(positions[field]?.fontCqw, wrapping);
            const pt = sizeInPt(stored, wrapping);
            const isDefault = Math.abs(stored - defaultFontCqw(wrapping)) < 0.0001;

            return (
              <div className="sp-field" key={field}>
                <div className="sp-field__top">
                  <label className="sp-field__label" htmlFor={`font-${field}`}>
                    {currentLabels[labelKey]}
                  </label>
                  <span className={isDefault ? 'sp-field__value' : 'sp-field__value sp-field__value--set'}>
                    {pt} pt
                  </span>
                </div>
                <div className="sp-field__row">
                  <input
                    id={`font-${field}`}
                    className="sp-input"
                    type="number"
                    step={FONT_STEP_PT}
                    min={MIN_FONT_PT}
                    max={MAX_FONT_PT}
                    value={drafts[field] ?? String(pt)}
                    onChange={(event) =>
                      setDrafts((current) => ({ ...current, [field]: event.target.value }))
                    }
                    onFocus={() => setEditing((current) => ({ ...current, [field]: true }))}
                    onBlur={(event) => {
                      commitDraft(field, event.target.value);
                      setEditing((current) => ({ ...current, [field]: false }));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                  />
                  <input
                    className="sp-range"
                    type="range"
                    aria-label={currentLabels[labelKey]}
                    min={MIN_FONT_PT}
                    max={MAX_FONT_PT}
                    step={FONT_STEP_PT}
                    value={pt}
                    onChange={(event) => setFontPt(field, Number(event.target.value))}
                  />
                </div>
              </div>
            );
          })}

          <footer className="sp-card__foot">
            <button type="button" className="sp-button" onClick={resetAll}>
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              {currentLabels.fontsReset}
            </button>
          </footer>
        </section>

        <section className="sp-card">
          <header className="sp-card__head">
            <h3 className="sp-card__title">{currentLabels.fontsSpecimen}</h3>
          </header>
          <p className="sp-card__hint">{currentLabels.fontsSpecimenHint}</p>

          {/*
           * نموذج بالحجم الحقيقي: ورقة 210×99 بيضاء ونصوص الحقول في
           * مواضعها وأحجامها، بنفس القواعد التي يرسم بها مستند الطباعة
           * (نفس clamp ونفس المحاذاة والالتفاف). هكذا يرى المستخدم
           * حجم الخط وهو مكتوب بدل أن يكتشفه بعد الطباعة.
           */}
          <div className="sp-specimen" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="sp-specimen__paper">
              {FONT_FIELDS.map(({ field }) => {
                const text = samples[field];
                if (!text) return null;

                const position = positions[field];
                const { rightAligned, wrapping } = FIELD_LAYOUT[field];
                const widthPercent = clampWidthPercent(position?.widthPercent);

                return (
                  <span
                    key={field}
                    className="sp-specimen__field"
                    data-field={field}
                    style={{
                      [rightAligned ? 'right' : 'left']: `${position?.x ?? 0}%`,
                      top: `${position?.y ?? 0}%`,
                      transform: `translate(${rightAligned ? '50%' : '-50%'}, -50%)`,
                      fontSize: `${clampFontCqw(position?.fontCqw, wrapping)}cqw`,
                      ...(wrapping
                        ? {
                            width: `${widthPercent}%`,
                            maxWidth: `${widthPercent}%`,
                            whiteSpace: 'normal',
                            overflowWrap: 'break-word',
                            lineHeight: 1.15,
                          }
                        : { whiteSpace: 'nowrap' }),
                    }}
                  >
                    {text}
                  </span>
                );
              })}
            </div>
          </div>

          <p className="sp-specimen__caption">{currentLabels.fontsWidthNote}</p>
        </section>
      </div>
    </div>
  );
};

/*
 * حارس ضد حقل جديد: CHECK_FIELDS هو المرجع، ولو أُضيف حقل ولم يُضبط
 * له حجم هنا لبقي على حجمه الافتراضي بصمت. الفحص عند تحميل الوحدة
 * (runtime) لا في الاختبار، فهو أقل كلفة ولا يغفل خطأً.
 */
const COVERED_FIELDS = new Set<string>(FONT_FIELDS.map((entry) => entry.field));
const MISSING_FIELDS = CHECK_FIELDS.filter((field) => !COVERED_FIELDS.has(field));
if (MISSING_FIELDS.length > 0) {
  throw new Error(`FontsTab: حقول بلا ضبط حجم خط: ${MISSING_FIELDS.join(', ')}`);
}

export default FontsTab;
