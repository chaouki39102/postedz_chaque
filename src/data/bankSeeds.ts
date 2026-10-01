/**
 * محتوى البذرة: تعريفات البنوك المضمَّنة في المشروع.
 *
 * هذا الملف هو ما يُنقل إلى قاعدة البيانات عند أول تشغيل فقط. بعد ذلك
 * تكون قاعدة البيانات هي مصدر الحقيقة، وتعديل هذا الملف لا يؤثر على
 * مستخدم فتح التطبيق من قبل (إلا إن رفعت seed_version).
 *
 * فائدة إبقائه في الكود: يُستخدم في وضع التراجع إلى localStorage حين
 * يتعذّر تشغيل SQLite، ولتوليد قائمة بذور مواضع لكل بنك.
 */

import type { BankSeedEntry } from '../data/seed';

/**
 * ملاحظة مهمة على صورة بريد الجزائر:
 * لا توجد صورة شيك لبريد الجزائر في المستودع. الملف المتاح
 * (alg-cndp.jpg) يخص القرض الشعبي الجزائري (CNEP)، وقد استُخدم خطأً
 * حتى تُضاف صورة بريد الجزائر الفعلية.
 *
 * لذلك نضع imageUrl فارغاً هنا: يظهر البنك بلا خلفية (نمط مُنقّط) بدل
 * أن يعرض خوارزمية بنك آخر — وهو خطأ في تطبيق مالي أسوأ من نقص صورة.
 */
export const BANK_SEEDS: readonly BankSeedEntry[] = [
  { id: 'bna_dz', nameAr: 'البنك الوطني الجزائري', nameFr: 'Banque Nationale d’Algérie', imageUrl: '/banks/alg-bna.jpg' },
  // TODO(image): استبدل بمسار صورة شيك بريد الجزائر عند توفرها
  { id: 'poste_dz', nameAr: 'بريد الجزائر', nameFr: 'Algérie Poste', imageUrl: '' },
  { id: 'cnep_dz', nameAr: 'القرض الشعبي الجزائري (CNEP)', nameFr: 'Crédit Populaire d’Algérie (CNEP)', imageUrl: '/banks/alg-cndp.jpg' },
  { id: 'cpa_dz', nameAr: 'القرض الشعبي الجزائري (CPA)', nameFr: 'Crédit Populaire d’Algérie (CPA)', imageUrl: '/banks/alg-cpa.jpg' },
  { id: 'abc_dz_2', nameAr: 'بنك ABC - نموذج 2', nameFr: 'ABC Bank - Modèle 2', imageUrl: '/banks/alg-abc2.jpg' },
  { id: 'abc_dz_24', nameAr: 'بنك ABC - نموذج 24', nameFr: 'ABC Bank - Modèle 24', imageUrl: '/banks/alg-abc24.jpg' },
  { id: 'alg_dz', nameAr: 'بنك الجزائر والخليج', nameFr: 'Banque d’Algérie et du Golfe', imageUrl: '/banks/alg-alg.jpg' },
  { id: 'bdl_dz', nameAr: 'بنك التنمية المحلية', nameFr: 'Banque de Développement Local', imageUrl: '/banks/alg-bdl.jpg' },
  { id: 'bdl_dz_2', nameAr: 'بنك التنمية المحلية - نموذج 2', nameFr: 'BDL - Modèle 2', imageUrl: '/banks/alg-bdl2.jpg' },
  { id: 'bea_dz', nameAr: 'البنك الخارجي الجزائري', nameFr: 'Banque Extérieure d’Algérie', imageUrl: '/banks/alg-bea.jpg' },
  { id: 'bna_dz_2', nameAr: 'البنك الوطني الجزائري - نموذج 2', nameFr: 'BNA - Modèle 2', imageUrl: '/banks/alg-bna2.jpg' },
  { id: 'bnp_dz', nameAr: 'BNP باريبا الجزائر', nameFr: 'BNP Paribas El Djazaïr', imageUrl: '/banks/alg-bnp.jpg' },
  { id: 'albaraka_dz', nameAr: 'بنك البركة الجزائر', nameFr: 'Al Baraka Bank Algérie', imageUrl: '/banks/alg-brka3.jpg' },
  { id: 'gulf_dz', nameAr: 'بنك الخليج الجزائر', nameFr: 'Gulf Bank Algérie', imageUrl: '/banks/alg-gulf3.jpg' },
  { id: 'housing_dz', nameAr: 'بنك الإسكان للتجارة والتمويل', nameFr: 'Housing Bank For Trade & Finance', imageUrl: '/banks/alg-hous.jpg' },
  { id: 'ntx_dz', nameAr: 'بنك NTX (عام)', nameFr: 'NTX Bank (Générique)', imageUrl: '/banks/alg-ntx.jpg' },
  { id: 'sga_dz', nameAr: 'سوسيتيه جنرال الجزائر', nameFr: 'Société Générale Algérie', imageUrl: '/banks/alg-sga.jpg' },
  { id: 'slm_dz', nameAr: 'بنك SLM (عام)', nameFr: 'SLM Bank (Générique)', imageUrl: '/banks/alg-slm2.jpg' },
  { id: 'trust_dz', nameAr: 'بنك الثقة الجزائر', nameFr: 'Trust Bank Algérie', imageUrl: '/banks/alg-trst.jpg' },
];
