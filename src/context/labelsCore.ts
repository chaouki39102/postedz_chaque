import { createContext, useContext, useMemo } from 'react';
import { LABEL_SEEDS } from '../data/labelSeeds';
import type { Language, LabelBundle } from '../types';

/**
 * التسميات: النواة والخطّافات.
 *
 * منفصلة عن مكوّن المزوّد (LabelsProvider) لأن قاعدة ESL في هذا
 * المشروع تشترط أن يصدّر ملف المكوّنات المكوّنات فقط. خلط الخطّافات
 * مع المكوّن يُعطّل Fast Refresh أثناء التطوير.
 *
 * لماذا التسميات في قاعدة البيانات أصلاً:
 * كل نص يظهر للمستخدم بيانات. التصحيح اللغوي، أو إضافة لغة ثالثة، أو
 * تخصيص التسميات لمؤسسة بعينها — كلها عمليات بيانات لا عمليات كود.
 */

type LabelMap = Readonly<Record<string, string>>;

export interface LabelsApi {
  language: Language;
  setLanguage: (language: Language) => void;
  /** يعيد التسمية بلغة الواجهة، مع استبدال المتغيرات {name} */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** يعيد التسمية بلغة محددة صراحة (للمحتوى الثنائي اللغة) */
  tn: (language: Language, key: string) => string;
  /** كل التسميات كما هي، لعرضها في واجهة الإدارة */
  all: readonly LabelBundle[];
  refresh: () => Promise<void>;
  /** هل يمكن تعديل التسميات؟ (لا في وضع التخزين المحدود) */
  isEditable: boolean;
}

export const LabelsContext = createContext<LabelsApi | null>(null);

/** القيم الاحتياطية: بذرة الكود، تُستخدم قبل التحميل أو عند الفشل */
export const buildFallbackMap = (bundles: readonly LabelBundle[], language: Language): LabelMap => {
  const map: Record<string, string> = {};
  for (const bundle of bundles) map[bundle.key] = bundle[language];
  return map;
};

/** بذرة الكود نفسها: تضمن وجود قيمة دون قراءة القاعدة */
export const CODE_FALLBACK: readonly LabelBundle[] = LABEL_SEEDS.map((seed) => ({
  key: seed.key,
  ar: seed.ar,
  fr: seed.fr,
}));

export const useLabels = (): LabelsApi => {
  const context = useContext(LabelsContext);
  if (context === null) {
    throw new Error('useLabels() must be used inside <LabelsProvider>');
  }
  return context;
};

/**
 * كائن تسميات يُقرأ مباشرة من قاعدة البيانات.
 *
 * `useLabelProxy('form.')` ثم `L.date` تقرأ `form.date` من جدول
 * labels. المكوّن لا يحمل نصاً ولا يعرف الترجمة: يفصل البنية عن اللغة.
 *
 * المفتاح غير الموجود يعود كنصه (مثل `form.typo`)، وهذا مقصود: يظهر
 * الخطأ في الواجهة فوراً بدل نص فارغ صامت.
 *
 * Proxy لا استبدال يدوي: عدد التسميات في المكوّنات يتجاوز الخمسين،
 * والبديل التلقائي يجعل إضافة مفتاح جديد سطراً واحداً في البذرة.
 */
export const useLabelProxy = (prefix: string): Record<string, string> => {
  // t تتغيّر هويتها عند تبديل اللغة، فهي تغطي إعادة البناء كاملة
  const { t } = useLabels();

  return useMemo(
    () =>
      new Proxy({} as Record<string, string>, {
        get: (_target, property) =>
          typeof property === 'string' ? t(`${prefix}${property}`) : undefined,
      }),
    [t, prefix]
  );
};
