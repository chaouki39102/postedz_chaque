import React, { useCallback, useEffect, useState } from 'react';
import { Ruler, RotateCcw, Check } from 'lucide-react';
import { useLabelProxy } from '../../context/labelsCore';
import type { PrintLayoutApi } from '../../hooks/usePrintLayout';
import {
  CHECK_HEIGHT_MM,
  CHECK_WIDTH_MM,
  MAX_SHEET_MARGIN_RIGHT_MM,
  MAX_SHEET_MARGIN_TOP_MM,
  MIN_SHEET_MARGIN_MM,
  SHEET_HEIGHT_MM,
  SHEET_WIDTH_MM,
} from '../../utils/printCheck';
import type { PositionMap } from '../../types';

/** مقياس الرسم: أبعاد الورقة بالملّيمتر 그대로 داخل viewBox */
const DIAGRAM_WIDTH = SHEET_WIDTH_MM;
const DIAGRAM_HEIGHT = SHEET_HEIGHT_MM;

interface PrintTabProps {
  printLayout: PrintLayoutApi;
  positions: PositionMap;
  setPositions: (updater: (current: PositionMap) => PositionMap) => void;
}

/**
 * حدود موضع نص المبلغ بالأرقام.
 *
 * موضع الحقل نسبةً إلى منتصف النص (انظر `renderField`)، فالمسافة
 * المقاسة من الحافة اليمنى يمكن أن تكون سالبة: نص طويل يتجاوز الحافة
 * عمداً. السالب مسموح، والحد الأعلى يمنع الخروج عن الشيك تماماً.
 */
const MIN_AMOUNT_RIGHT_MM = -40;
const MAX_AMOUNT_RIGHT_MM = CHECK_WIDTH_MM;

const toMm = (percent: number): number =>
  Math.round((CHECK_WIDTH_MM - (percent / 100) * CHECK_WIDTH_MM) * 10) / 10;

const toPercent = (mm: number): number =>
  Math.round(((CHECK_WIDTH_MM - mm) / CHECK_WIDTH_MM) * 100 * 100) / 100;

/**
 * إعدادات الطباعة: موضع الشيك على الورقة وموضع المبلغ داخله.
 *
 * الرقمان الأولان يحددان أين يجلس الشيك الورقي على الورقة المطبوعة،
 * والثالث يحدد أين يجلس نص المبلغ على الشيك نفسه. الثلاثة بالملّيمتر
 * لأنها الوحدة الوحيدة التي يصحّ فيها أن يطابق رقم في البرنامج ورقماً
 * على الورق بمسطرة.
 */
const PrintTab: React.FC<PrintTabProps> = ({ printLayout, positions, setPositions }) => {
  const currentLabels = useLabelProxy('manage.');
  const { layout, setMargin, reset, isSaved } = printLayout;

  /*
   * الحقول النصية تبقى في الشاشة كما تركها المستخدم؛ القيمة المحفوظة
   * تُعاد إلى الحقل فقط عند Outlet لتغيير الموضع. بدون هذا يُمسح الرقم
   * أثناء الكتابة كلما أعاد التطبيق ترتيب الخانات.
   */
  const [rightDraft, setRightDraft] = useState(String(layout.marginRightMm));
  const [topDraft, setTopDraft] = useState(String(layout.marginTopMm));
  const [amountDraft, setAmountDraft] = useState(String(toMm(positions.amount?.x ?? 0)));

  useEffect(() => {
    setRightDraft(String(layout.marginRightMm));
    setTopDraft(String(layout.marginTopMm));
  }, [layout.marginRightMm, layout.marginTopMm]);

  useEffect(() => {
    setAmountDraft(String(toMm(positions.amount?.x ?? 0)));
  }, [positions.amount?.x]);

  const commitMargin = useCallback(
    (axis: 'marginRightMm' | 'marginTopMm', draft: string) => {
      const parsed = Number(draft.replace(',', '.'));
      if (draft.trim() === '' || !Number.isFinite(parsed)) return;
      setMargin(axis, parsed);
    },
    [setMargin]
  );

  /*
   * الموضع يُكتب في مواضع البنك نفسه لا في تفضيل الطباعة: هكذا
   * ينتقل مع القوالب ويُحفظ لكل لغة، وتبقى المعاينة مطابقة للمطبوع
   * بلا قاعدة ثانية تختلف عنه.
   */
  const commitAmountRight = useCallback(
    (draft: string) => {
      const parsed = Number(draft.replace(',', '.'));
      if (draft.trim() === '' || !Number.isFinite(parsed)) return;
      const clamped = Math.min(MAX_AMOUNT_RIGHT_MM, Math.max(MIN_AMOUNT_RIGHT_MM, parsed));

      setPositions((current) => ({
        ...current,
        amount: { ...current.amount, x: toPercent(clamped) },
      }));
    },
    [setPositions]
  );

  const amountRightMm = Math.min(
    MAX_AMOUNT_RIGHT_MM,
    Math.max(MIN_AMOUNT_RIGHT_MM, toMm(positions.amount?.x ?? 0))
  );

  const chequeLeft = SHEET_WIDTH_MM - CHECK_WIDTH_MM - layout.marginRightMm;
  const isCentered =
    Math.abs(layout.marginRightMm - (SHEET_WIDTH_MM - CHECK_WIDTH_MM) / 2) < 0.05 &&
    Math.abs(layout.marginTopMm - (SHEET_HEIGHT_MM - CHECK_HEIGHT_MM) / 2) < 0.05;

  return (
    <div className="sp-print">
      <div className="sp-print__grid">
        <section className="sp-card">
          <header className="sp-card__head">
            <Ruler className="sp-card__icon" aria-hidden="true" />
            <h3 className="sp-card__title">{currentLabels.printSheetTitle}</h3>
          </header>
          <p className="sp-card__hint">{currentLabels.printSheetHint}</p>

          <div className="sp-field">
            <div className="sp-field__top">
              <label className="sp-field__label" htmlFor="print-margin-right">
                {currentLabels.printMarginRight}
              </label>
              <span className="sp-field__value">{layout.marginRightMm} mm</span>
            </div>
            <div className="sp-field__row">
              <input
                id="print-margin-right"
                className="sp-input"
                type="number"
                step={0.5}
                min={MIN_SHEET_MARGIN_MM}
                max={MAX_SHEET_MARGIN_RIGHT_MM}
                value={rightDraft}
                onChange={(event) => setRightDraft(event.target.value)}
                onBlur={(event) => commitMargin('marginRightMm', event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
              <input
                className="sp-range"
                type="range"
                aria-label={currentLabels.printMarginRight}
                min={MIN_SHEET_MARGIN_MM}
                max={MAX_SHEET_MARGIN_RIGHT_MM}
                step={0.5}
                value={layout.marginRightMm}
                onChange={(event) => setMargin('marginRightMm', Number(event.target.value))}
              />
            </div>
          </div>

          <div className="sp-field">
            <div className="sp-field__top">
              <label className="sp-field__label" htmlFor="print-margin-top">
                {currentLabels.printMarginTop}
              </label>
              <span className="sp-field__value">{layout.marginTopMm} mm</span>
            </div>
            <div className="sp-field__row">
              <input
                id="print-margin-top"
                className="sp-input"
                type="number"
                step={0.5}
                min={MIN_SHEET_MARGIN_MM}
                max={MAX_SHEET_MARGIN_TOP_MM}
                value={topDraft}
                onChange={(event) => setTopDraft(event.target.value)}
                onBlur={(event) => commitMargin('marginTopMm', event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
              <input
                className="sp-range"
                type="range"
                aria-label={currentLabels.printMarginTop}
                min={MIN_SHEET_MARGIN_MM}
                max={MAX_SHEET_MARGIN_TOP_MM}
                step={0.5}
                value={layout.marginTopMm}
                onChange={(event) => setMargin('marginTopMm', Number(event.target.value))}
              />
            </div>
          </div>

          <footer className="sp-card__foot">
            <button
              type="button"
              className="sp-button sp-button--ghost"
              onClick={reset}
              disabled={isCentered}
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              {currentLabels.printReset}
            </button>
            <span className="sp-saved" role="status">
              {isSaved ? (
                <>
                  <Check className="w-4 h-4" aria-hidden="true" />
                  {currentLabels.saved}
                </>
              ) : null}
            </span>
          </footer>
        </section>

        <div className="sp-print__side">
          <figure className="sp-diagram">
            <svg
              viewBox={`0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`}
              role="img"
              aria-label={currentLabels.printDiagram}
            >
              <rect
                x={0}
                y={0}
                width={DIAGRAM_WIDTH}
                height={DIAGRAM_HEIGHT}
                className="sp-diagram__sheet"
              />
              {/* شبكة كل 10mm: المسطرة التي يضبط عليها الهامش */}
              {Array.from({ length: Math.floor(DIAGRAM_WIDTH / 10) + 1 }, (_, i) => (
                <line
                  key={`v${i}`}
                  x1={i * 10}
                  y1={0}
                  x2={i * 10}
                  y2={DIAGRAM_HEIGHT}
                  className="sp-diagram__grid"
                />
              ))}
              {Array.from({ length: Math.floor(DIAGRAM_HEIGHT / 10) + 1 }, (_, i) => (
                <line
                  key={`h${i}`}
                  x1={0}
                  y1={i * 10}
                  x2={DIAGRAM_WIDTH}
                  y2={i * 10}
                  className="sp-diagram__grid"
                />
              ))}
              <rect
                x={chequeLeft}
                y={layout.marginTopMm}
                width={CHECK_WIDTH_MM}
                height={CHECK_HEIGHT_MM}
                className="sp-diagram__cheque"
              />
              {/* علامة المبلغ: خط رأسي عند منتصف النص على الحافة اليمنى للشيك */}
              <line
                x1={chequeLeft + (positions.amount?.x ?? 0) * (CHECK_WIDTH_MM / 100)}
                y1={layout.marginTopMm}
                x2={chequeLeft + (positions.amount?.x ?? 0) * (CHECK_WIDTH_MM / 100)}
                y2={layout.marginTopMm + CHECK_HEIGHT_MM}
                className="sp-diagram__amount"
              />
            </svg>
            <figcaption className="sp-diagram__caption">
              <span>
                {currentLabels.printMarginRight}: <b>{layout.marginRightMm} mm</b>
              </span>
              <span>
                {currentLabels.printMarginTop}: <b>{layout.marginTopMm} mm</b>
              </span>
              <span>
                {currentLabels.printAmountRight}: <b>{amountRightMm} mm</b>
              </span>
            </figcaption>
          </figure>

          <section className="sp-card">
            <header className="sp-card__head">
              <h3 className="sp-card__title">{currentLabels.printAmountTitle}</h3>
            </header>
            <p className="sp-card__hint">{currentLabels.printAmountHint}</p>

            <div className="sp-field">
              <div className="sp-field__top">
                <label className="sp-field__label" htmlFor="print-amount-right">
                  {currentLabels.printAmountRight}
                </label>
                <span className="sp-field__value">{amountRightMm} mm</span>
              </div>
              <div className="sp-field__row">
                <input
                  id="print-amount-right"
                  className="sp-input"
                  type="number"
                  step={0.5}
                  min={MIN_AMOUNT_RIGHT_MM}
                  max={MAX_AMOUNT_RIGHT_MM}
                  value={amountDraft}
                  onChange={(event) => setAmountDraft(event.target.value)}
                  onBlur={(event) => commitAmountRight(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                />
                {/*
                 * منزلق للمبلغ بلا: قيسته عكس اتجاه المسافة (رقم أكبر =
                 * أقرب إلى اليسار)، فيسحب المنزلق عكس ما تراه العين.
                 * السحب في المعاينة هو التحكم البصري، وهذا الحقل للدقة.
                 */}
                <p className="sp-field__note">{currentLabels.printAmountDrag}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrintTab;
