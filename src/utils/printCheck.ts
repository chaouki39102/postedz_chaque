import type { CheckField, Language, Position } from '../types';

/**
 * طباعة الشيك في نافذة مستقلة.
 *
 * لماذا نافذة مستقلة لا `@media print` في صفحة التطبيق:
 * الشيك يُطبع على ورق شيك حقيقي بمقاس 210×99mm، والورقة هي كل ما
 * يهم. صفحة التطبيق تحمل واجهة كاملة (رأس، أزرار، قوالب، وضع داكن)
 * ولا تُختصر في ورقة واحدة إلا بإلغاءات متتابعة يسقط منها شيء مع
 * أول تعديل. النافذة المستقلة مستند نظيف: نتحكم في `@page` والمقاس
 * والتوسيط، ولا يصل إليه من CSS التطبيق شيء.
 *
 * الطريقة هذه هي التي كانت داخل `CheckPreview` قبل أن تكبر: بناء
 * مستند الطباعة نصاً كاملاً في نافذة مستقلة.
 */

/** مقاس ورقة الشيك الحقيقي بالملّيمتر */
export const CHECK_WIDTH_MM = 210;
export const CHECK_HEIGHT_MM = 99;

/**
 * الورقة التي تُطبع عليها (A4 أفقية) ومقاس الشيك داخلها.
 *
 * الأبعاد معلنة هنا لا مكتوبة في CSS: واجهة الإعدادات تحسب منها
 * المواضع وترسم مخطط الورقة، فلا تُكرَّر الأرقام في ثلاثة ملفات.
 */
export const SHEET_WIDTH_MM = 297;
export const SHEET_HEIGHT_MM = 210;

/**
 * أقل هامش ممكن بين الشيك وحافة الورقة.
 *
 * الطابعات لا تطبع عادةً خلال 5 إلى 10 مم من حافة الورق، فهامش
 * أصغر من ذلك يجعل نص الشيك ينقص عند الطباعة. لذلك هو الحد الأدنى
 * لا خيار مفتوح.
 */
export const MIN_SHEET_MARGIN_MM = 5;

/** أقصى هامش على كل محور: الشيك كله يبقى داخل الورقة */
export const MAX_SHEET_MARGIN_RIGHT_MM =
  SHEET_WIDTH_MM - CHECK_WIDTH_MM - MIN_SHEET_MARGIN_MM;
export const MAX_SHEET_MARGIN_TOP_MM =
  SHEET_HEIGHT_MM - CHECK_HEIGHT_MM - MIN_SHEET_MARGIN_MM;

/**
 * موضع الشيك على الورقة: المسافة من حافتي الورقة بالملّيمتر.
 *
 * المسافة لا الإزاحة عن الوسط: المستخدم الذي يضع الشيك الورقي على
 * حافة الورقة يرى المسافة التي سيتركها، وهي ما يريد ضبطه. وأرقام
 * الوسط (43.5 و55.5) ناتج حسابي لا معنى له عنده.
 */
export interface PrintLayout {
  /** بين حافة الشيك اليمنى وحافة الورقة اليمنى */
  marginRightMm: number;
  /** بين حافة الشيك العليا وحافة الورقة العليا */
  marginTopMm: number;
}

/** التوسيط: الشيك في وسط الورقة (الوضع الافتراضي) */
export const CENTERED_LAYOUT: PrintLayout = {
  marginRightMm: (SHEET_WIDTH_MM - CHECK_WIDTH_MM) / 2,
  marginTopMm: (SHEET_HEIGHT_MM - CHECK_HEIGHT_MM) / 2,
};

/**
 * يحدّ الهوامش إلى مجال صالح.
 *
 * نفس الدالة في الواجهة وفي مستند الطباعة: الرقم المكتوب في الحقل
 * وما يخرج فعلاً على الورقة لا يفترقان، والقيمة التالفة في القاعدة
 * (نصف، NaN، خارج المجال) تعود إلى الوسط بدل أن تُطبع في الفراغ.
 */
export const clampLayout = (layout?: Partial<PrintLayout> | null): PrintLayout => {
  const limit = (value: unknown, min: number, max: number, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : fallback;

  return {
    marginRightMm: limit(
      layout?.marginRightMm,
      MIN_SHEET_MARGIN_MM,
      MAX_SHEET_MARGIN_RIGHT_MM,
      CENTERED_LAYOUT.marginRightMm
    ),
    marginTopMm: limit(
      layout?.marginTopMm,
      MIN_SHEET_MARGIN_MM,
      MAX_SHEET_MARGIN_TOP_MM,
      CENTERED_LAYOUT.marginTopMm
    ),
  };
};

/**
 * أحجام الخط بوحدة cqw (1% من عرض الشيك) لا px ولا pt.
 *
 * المطبوع يُبنى بنفس عرض المعاينة تماماً (210mm)، فيحسب المتصفح
 * الحجم نفسه فيتطابق عدد أسطر المبلغ بالحروف بين المعاينة والطباعة.
 * حجم ثابت بالبكسل أو النقطة يملأ عرضاً مختلفاً في أحدهما.
 */
export const FIELD_FONT_CQW = 1.9;
export const AMOUNT_WORDS_FONT_CQW = 1.848;

/** مدى الحجم المسموح لكل حقل (cqw) */
export const MIN_FONT_CQW = 1;
export const MAX_FONT_CWQ = 3.4;

/**
 * ملّيمتر إلى نقطة: النقطة وحدة الطباعة التي يعرفها المستخدم، ونقطة
 * واحدة = 25.4/72 مم. التحويل معروف في اتجاهه (cqw ↔ pt) فلا تُحسب
 * الأرقام في الواجهة ولا في المستند ولا يتفرقان.
 */
export const MM_PER_INCH = 25.4;
export const PT_PER_INCH = 72;

/** حجم الخط الافتراضي لحقل: المبلغ بالحروف أصغر قليلاً لأنه يكثر أسطره */
export const defaultFontCqw = (wrapping: boolean): number =>
  wrapping ? AMOUNT_WORDS_FONT_CQW : FIELD_FONT_CQW;

/**
 * يحدّ حجم الخط إلى مجال صالح ويعيد الافتراضي عند غيابه.
 *
 * نفس الدالة في المعاينة وفي مستند الطباعة: الرقم المحفوظ وما يُطبع
 * فعلاً لا يفترقان، والقيمة التالفة (صفر، NaN، حجم ضخم) ترجع إلى
 * الحجم الافتراضي بدل أن يختفي الحقل أو يملأ الشيك كله.
 */
export const clampFontCqw = (value: number | undefined, wrapping: boolean): number => {
  const fallback = defaultFontCqw(wrapping);
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(MAX_FONT_CWQ, Math.max(MIN_FONT_CQW, value));
};

/** حجم الخط بالنقطة على ورق 210mm: 1cqw = 2.1مم ≈ 5.95pt */
export const cqwToPt = (cqw: number): number =>
  (cqw / 100) * CHECK_WIDTH_MM * (PT_PER_INCH / MM_PER_INCH);

/** نفس التحويل بالعكس: نقطة ← cqw (لأن المستخدم يضبط بالنقاط) */
export const ptToCqw = (pt: number): number =>
  (pt * (MM_PER_INCH / PT_PER_INCH)) / CHECK_WIDTH_MM * 100;

/** مدى عرض نص المبلغ بالحروف (نسبة مئوية من عرض الشيك) */
export const MIN_WIDTH_PERCENT = 10;
export const MAX_WIDTH_PERCENT = 95;
export const DEFAULT_WIDTH_PERCENT = 50;

/**
 * يحدّ عرض المبلغ بالحروف إلى نطاق صالح.
 *
 * العرض نسبة مئوية من عرض الشيك وليس بكسل، لأن العرض بالبكسل كان يجعل
 * الالتفاف مختلفاً بين المعاينة (≈900px) والطباعة (210mm ≈ 794px)،
 * فيخرج النص المطبوع غير مطابق للمعاينة.
 */
export const clampWidthPercent = (value: number | undefined): number => {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_WIDTH_PERCENT;
  return Math.min(MAX_WIDTH_PERCENT, Math.max(MIN_WIDTH_PERCENT, value));
};

/**
 * محاذاة كل حقل في الشيك: يمين أم يسار، ويلتفّ أم سطر واحد.
 *
 * معرّف واحد يستعمله رسم المعاينة ورسم مستند الطباعة ورسم نموذج الخطوط
 * في الإعدادات. قبل ذلك كانت المحاذاة والالتفاف مُعلَّمين في أكثر من
 * موضع، فيكفي أن يتغير أحدها ليخرج المطبوع عن المعاينة.
 */
export const FIELD_LAYOUT: Record<CheckField, { rightAligned: boolean; wrapping: boolean }> = {
  date: { rightAligned: false, wrapping: false },
  place: { rightAligned: false, wrapping: false },
  beneficiary: { rightAligned: true, wrapping: false },
  amount: { rightAligned: false, wrapping: false },
  amountWords: { rightAligned: true, wrapping: true },
};


/**
 * مهلة انتظار جاهزية الخطوط والصور.
 *
 * مهلة لا انتظار أبدي: الخط أو الصورة إن تعذّر تحميلهما يجب أن يطبع
 * الشيك بالاحتياطي بدل أن لا يطبع أصلاً.
 */
const READY_TIMEOUT_MS = 2000;

/** مهلة قبل إغلاق النافذة بعد انتهاء حوار الطباعة */
const CLOSE_DELAY_MS = 1000;

/** حقل واحد في ورقة الطباعة */
export interface PrintedField {
  /** النص كما سيُطبع، فارغ = لا يُطبع (يتبع المعاينة) */
  value: string;
  position: Position;
  /** الحقول المحاذاة لليمين تُثبَّت بـ right لا left */
  rightAligned: boolean;
  /** المبلغ بالحروف: نص ملتفّ بعرض محدود لا نص في سطر واحد */
  wrapping: boolean;
}

export interface PrintRequest {
  /** عنوان النافذة (من جدول التسميات) */
  title: string;
  language: Language;
  /** صورة البنك، أو null للطباعة دون صورة (شيك فارغ في الطابعة) */
  imageUrl: string | null;
  fields: readonly PrintedField[];
  /** موضع الشيك على الورقة؛ يُحاذى إلى الوسط إن لم يُمرَّر */
  layout?: Partial<PrintLayout> | null;
}

export type PrintResult = { ok: true } | { ok: false; reason: 'popup-blocked' };

/**
 * النصوص قادمة من إدخال المستخدم وتُحقن في مستند الطباعة نصاً.
 * بدون تهريب، اسم مستفيد يحوي `</div>` يكسر المستند أو يحقن وسماً.
 */
const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });

/** نسبة صالحة لخاصية CSS: قيمة تالفة تُهمَل بدل `NaN%` */
const cssNumber = (value: number | undefined, fallback = 0): string =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : String(fallback);

/**
 * روابط الخطوط محلية لا من Google Fonts: التطبيق يعمل بلا إنترنت،
 * والخط البعيد يمرّ بطباعة النافذة قبل تحميله فلا يخرج النص بارتفاعات
 * الحرف الاحتياطي.
 *
 * المسار نسبي لـ baseURI لا مطلق: التطبيق قد يُخدَم من مجلد فرعي
 * (htdocs/xxx) فيفشل المسار المطلق `/fonts/...`.
 */
const fontFaceCss = (): string => {
  const url = (file: string): string => new URL(`fonts/${file}`, document.baseURI).href;

  return `
      @font-face {
        font-family: 'Cairo';
        font-style: normal;
        font-weight: 400;
        font-display: block;
        src: url('${url('cairo-400-arabic.woff2')}') format('woff2');
        unicode-range: U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC;
      }
      @font-face {
        font-family: 'Cairo';
        font-style: normal;
        font-weight: 400;
        font-display: block;
        src: url('${url('cairo-400-latin.woff2')}') format('woff2');
        unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
      }`;
};

const renderField = (field: PrintedField): string => {
  if (field.value === '') return '';

  const side = field.rightAligned ? 'right' : 'left';
  const shift = field.rightAligned ? '50%' : '-50%';
  /*
   * حجم الحقل من مواضعه (fontCqw) لا من ثابت عام: الضبط الذي رآه
   * المستخدم في المعاينة هو نفسه الذي يخرج على الورقة. الغياب أو
   * القيمة التالفة ترجع إلى الحجم الافتراضي لهذا الحقل.
   */
  const fontSize = clampFontCqw(field.position.fontCqw, field.wrapping);

  /*
   * لا حشو في المطبوع: الحشو في المعاينة للتمييز البصري فقط، وهو
   * يسرق من العرض المحدد فيقلّ الالتفاف عن المعاينة. وحقل المبلغ
   * بالحروف بلا حشو أفقي أصلاً.
   */
  const wrap = field.wrapping
    ? `width:${cssNumber(field.position.widthPercent, 50)}%;max-width:${cssNumber(field.position.widthPercent, 50)}%;white-space:normal;overflow-wrap:break-word;line-height:1.15;`
    : 'white-space:nowrap;';

  return `<div class="field" style="${side}:${cssNumber(field.position.x)}%;top:${cssNumber(field.position.y)}%;transform:translate(${shift}, -50%);font-size:${fontSize}cqw;${wrap}">${escapeHtml(field.value)}</div>`;
};

/** يبني مستند الطباعة كاملاً (HTML مستقل بذاته) */
export const buildPrintDocument = (request: PrintRequest): string => {
  const image =
    request.imageUrl === null
      ? ''
      : `<img src="${escapeHtml(request.imageUrl)}" alt="" />`;

  const fields = request.fields.map((field) => `        ${renderField(field)}`).join('\n');

  /*
   * موضع الشيك من الهوامش لا من التوسيط: الحافة اليمنى أقرب إلى حافة
   * الورقة كما يطلب المستخدم، والشيك على بُعد الأرقام نفسها من اليسار
   * وأعلى (297-210 = 87mm و210-99 = 111mm على المحورين).
   */
  const layout = clampLayout(request.layout);
  const left = SHEET_WIDTH_MM - CHECK_WIDTH_MM - layout.marginRightMm;
  const top = layout.marginTopMm;

  return `<!DOCTYPE html>
<html dir="${request.language === 'ar' ? 'rtl' : 'ltr'}">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(request.title)}</title>
    <style>${fontFaceCss()}

      @page {
        /*
         * A4 أفقية بلا هوامش: مساحة المحتوى تصير الورقة كلها (297×210mm).
         *
         * بهوامش 70mm/50mm كانت مساحة المحتوى 197×70mm أصغر من الشيك
         * (210×99mm)، فيفيض عن صندوق الهوامش ويُقصّ overflow:hidden
         * ما زاد منه — وهو سبب ظهور الحقول خارج مجال الطباعة على اليمين.
         * بلا هوامش لا يبقى ما يُقصّ.
         */
        size: A4 landscape;
        margin: 0;
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: 'Cairo', Arial, sans-serif;
        background: #ffffff;
        /*
         * لا overflow:hidden: أي فيض يجب أن يبقى مرسوماً داخل الورقة
         * بدل أن يُقصّ. وبلا هوامش في @page لا فيض أصلاً.
         */
        position: relative;
      }

      .cheque {
        position: absolute;
        /* الهامش الذي طلبه المستخدم: ${layout.marginRightMm}mm من اليمين، ${layout.marginTopMm}mm من الأعلى */
        left: ${cssNumber(left)}mm;
        top: ${cssNumber(top)}mm;
        width: ${CHECK_WIDTH_MM}mm;
        height: ${CHECK_HEIGHT_MM}mm;
        /* أساس وحدة cqw: 1% من عرض الشيك، فيتطابق حساب الخط مع المعاينة */
        container-type: inline-size;
        overflow: hidden;
        page-break-inside: avoid;
      }

      .cheque > img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .field {
        position: absolute;
        color: #000000;
        font-weight: 700;
      }

      @media print {
        .field {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    </style>
  </head>
  <body>
    <div class="cheque">
      ${image}
${fields}
    </div>
  </body>
</html>`;
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

/**
 * ينتظر خطوط النافذة وصورها قبل الطباعة.
 *
 * الخط قبل الطباعة ضروري: المبلغ يُكتب بـ Cairo، والطباعة قبل تحميله
 * تعطي حروفاً بخط الاحتياطي بارتفاعات مختلفة فينزاح النص عن مواضعه
 * المحفوظة. والصورة عنصر <img> لا خلفية CSS: المتصفحات لا تطبع خلفيات
 * CSS إلا بخيار «طباعة الرسومات الخلفية» في حوار الطباعة.
 */
const waitForPrintable = async (target: Window): Promise<void> => {
  const doc = target.document;

  await Promise.all(
    Array.from(doc.images).map((image) =>
      image.complete
        ? null
        : new Promise<void>((resolve) => {
            image.addEventListener('load', () => resolve(), { once: true });
            image.addEventListener('error', () => resolve(), { once: true });
          })
    )
  );

  await doc.fonts?.ready;
};

/**
 * يطبع الشيك في نافذة مستقلة ويفتح حوار الطباعة فيها.
 *
 * `window.open` تُستدعى داخل معالج النقر مباشرة: النافذة المنبثقة
 * تحتاج فعل المستخدم، وأي `await` قبلها يجعل المتصفح يحجبها.
 *
 * لا نعتمد على حدث `load` بعد `document.write`: الاستدعاء بعد
 * `document.close()` يقع بعد اكتمال التحليل، فلا يُستدعى البتة
 * ولا يفتح الحوار. الانتظار هنا صريح: الخطوط ثم الصور.
 */
export const printCheck = (request: PrintRequest): PrintResult => {
  const target = window.open('', '_blank', 'width=1000,height=700');
  if (target === null) return { ok: false, reason: 'popup-blocked' };

  target.document.write(buildPrintDocument(request));
  target.document.close();

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    if (!target.closed) target.close();
  };
  target.addEventListener('afterprint', close);

  void (async () => {
    try {
      await Promise.race([waitForPrintable(target), delay(READY_TIMEOUT_MS)]);
    } catch {
      /* الخط أو الصورة لم يجهزا: نطبع بالاحتياطي بدل ألا نطبع */
    }

    if (target.closed) return;
    target.focus();
    target.print();
    window.setTimeout(close, CLOSE_DELAY_MS);
  })();

  return { ok: true };
};
