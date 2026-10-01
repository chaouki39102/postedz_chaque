/**
 * القيم الافتراضية لحقول الشيك، لكل لغة.
 *
 * كانت هذه النصوص ثابتة داخل App.tsx، والتاريخ يُحسَب في الكود. نقلها
 * إلى هنا يجعلها بيانات: تُبذَر في جدول field_defaults، ويقرأها
 * `useCheckState` عند أول تشغيل، ويعدّلها المستخدم من واجهة الإدارة.
 *
 * حقل التاريخ له معاملة خاصة، انظر `TODAY` أدناه.
 */

import type { Language } from '../types';

export interface FieldDefaultSeed {
  language: 'ar' | 'fr';
  field: 'date' | 'place' | 'beneficiary' | 'amount';
  value: string;
}

/**
 * القيمة المخزَّنة لحقل التاريخ.
 *
 * لا نخزّن تاريخاً ثابتاً: شيك بتاريخ التأسيس يخطئ بعد يوم واحد. نخزّن
 * هذه العلامة، ويحلّها المحرك إلى تاريخ اليوم عند كل قراءة. النتيجة
 * أن القيمة مخزّنة في القاعدة (وقابلة للتعديل)، بينما يبقى السلوك صحيحاً
 * في كل يوم دون كتابة.
 */
export const TODAY = '__today__';

export const FIELD_DEFAULT_SEEDS: readonly FieldDefaultSeed[] = [
  // ---- العربية ----
  { language: 'ar', field: 'date', value: TODAY },
  { language: 'ar', field: 'place', value: 'الوادي' },
  { language: 'ar', field: 'beneficiary', value: 'شركة الحاج علي بيوض للتجارة ذ م م' },
  { language: 'ar', field: 'amount', value: '500000.00' },

  // ---- الفرنسية ----
  { language: 'fr', field: 'date', value: TODAY },
  { language: 'fr', field: 'place', value: 'EL-OUED' },
  {
    language: 'fr',
    field: 'beneficiary',
    value: 'SARL ELHADJ ALI BAYOUDH COMMERCE',
  },
  { language: 'fr', field: 'amount', value: '500000.00' },
];

/** خريطة سريعة للحقول التي لها قيمة افتراضية */
export const DEFAULTED_FIELDS = ['date', 'place', 'beneficiary', 'amount'] as const;

export type DefaultedField = (typeof DEFAULTED_FIELDS)[number];

const toEntry = (language: Language) => {
  const value = (field: DefaultedField) =>
    FIELD_DEFAULT_SEEDS.find((row) => row.language === language && row.field === field)?.value ?? '';

  return { place: value('place'), beneficiary: value('beneficiary'), amount: value('amount') };
};

/**
 * نفس القيم، مخرَجة كخريطة للقراءة السريعة وللمحرك الاحتياطي.
 *
 * مصدر الحقيقة هو الجدول. هذه نسخة متطابقة معه تُستخدم حين لا تتوفر
 * القاعدة، ولهذا نملؤها من نفس المصفوفة بدل كتابتها مرتين.
 */
export const FALLBACK_FIELD_DEFAULTS: Record<
  Language,
  { place: string; beneficiary: string; amount: string }
> = {
  ar: toEntry('ar'),
  fr: toEntry('fr'),
};
