import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CheckForm from './components/CheckForm';
import CheckPreview from './components/CheckPreview';
import ManagementPanel from './components/manage/ManagementPanel';
import { FallbackBanner } from './components/BootScreen';
import { Sparkles, Globe, BookOpen, Award, Shield, Zap, Users, Sun, Moon, Settings } from 'lucide-react';
import { mergeWithDefaults } from './banksData';
import { useBankImageUrl, useBanks } from './hooks/useBanks';
import { useDirection } from './hooks/useDirection';
import { useDarkMode } from './hooks/useDarkMode';
import { useCheckState } from './hooks/useCheckState';
import { usePresets } from './hooks/usePresets';
import { usePrintLayout } from './hooks/usePrintLayout';
import { useEngineKind } from './context/engineCore';
import { useLabels } from './context/labelsCore';
import { getRepository } from './data';
import { PREF_KEYS } from './data/repository';
import { releaseAllImageUrls } from './data/imageCache';
import { APP_LOGO_URL } from './constants';
import { FALLBACK_FIELD_DEFAULTS } from './data/fieldDefaults';
import { numberToArabicWords, numberToFrenchWords } from './utils/numberToWords';
import type { CheckData, Language, Preset } from './types';

/**
 * مصدر القيم الافتراضية عند تعذّر قراءة القاعدة.
 *
 * هذه ليست القيم الفعلية: القيم في جدول field_defaults وتُقرأ منها
 * (بما فيها التاريخ). هذا نسخة احتياطية للمحرك المحدود localStorage،
 * الذي لا يعرف هذا الجدول. وجودها هنا لا يجعلها مصدر الحقيقة.
 */
const fallbackDefaults = (language: Language): Omit<CheckData, 'date'> => ({
  place: FALLBACK_FIELD_DEFAULTS[language].place,
  beneficiary: FALLBACK_FIELD_DEFAULTS[language].beneficiary,
  amount: FALLBACK_FIELD_DEFAULTS[language].amount,
});

const App: React.FC = () => {
  const { language, setLanguage, t, refresh: refreshLabels } = useLabels();
  const engineKind = useEngineKind();
  const { banks, getBank, isLoading: isBanksLoading, refresh: refreshBanks } = useBanks();

  /*
   * البنك المختار مُعرَّف بمعرّفه لا بالعنصر نفسه: العنصر يُعاد بنسخة
   * جديدة كل تحميل، فالاحتفاظ به في الحالة يجعل المقارنة بالمرجع
   * غير ضرورية ويكسر useMemo في كل مكان.
   */
  const [bankId, setBankId] = useState<string>('');
  const [isManageOpen, setIsManageOpen] = useState(false);

  useDirection(language);
  const { isDark, toggleDarkMode } = useDarkMode();

  /*
   * البنك المختار يُقرأ من التفضيلات لا من أول القائمة: المستخدم يتكرر
   * على نفس البنك، وفتح التطبيق على بنك آخر يعني تعديل الحقول في كل مرة.
   *
   * لا نزاع على القيمة لأن BootGate ينتظر إقلاع المحرك قبل أول رسم:
   * أول تحميل هو ما يملأ الحالة، وشرط bankId !== '' يمنع الحفظ قبل
   * اكتمال القراءة.
   */
  useEffect(() => {
    if (bankId !== '') return;

    let cancelled = false;
    void getRepository()
      .getPreference(PREF_KEYS.bank)
      .then((saved) => {
        if (!cancelled && saved !== null) setBankId(saved);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [bankId]);

  /*
   * حفظ الاختيار بعد استقراره: الكتابة عند كل رسم تكتب قيمة لم
   * تكتمل قراءتها بعد، والقيمة الفارغة تمسح التفضيل.
   */
  const bankIdRef = useRef(bankId);
  bankIdRef.current = bankId;
  useEffect(() => {
    if (bankId === '') return;
    const timer = window.setTimeout(() => {
      void getRepository().setPreference(PREF_KEYS.bank, bankIdRef.current);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [bankId]);

  // أول بنك متاح يصبح الافتراضي إن لم يوجد تفضيل صالح
  useEffect(() => {
    if (bankId !== '' && banks.some((bank) => bank.id === bankId)) return;
    const first = banks[0];
    if (first === undefined) return;
    setBankId(first.id);
  }, [banks, bankId]);

  const currentBank = useMemo(() => getBank(bankId) ?? banks[0] ?? null, [getBank, bankId, banks]);

  /*
   * رابط صورة البنك المعروض وحده: القائمة لا تحتاجه، والكل هنا يعني
   * إنشاء صورة معرّفة لكل بنك في القاعدة بلا استفادة.
   */
  const currentImageUrl = useBankImageUrl(currentBank);
  const previewBank = useMemo(
    () => (currentBank === null ? null : { ...currentBank, imageUrl: currentImageUrl }),
    [currentBank, currentImageUrl]
  );

  /*
   * لا نركّب الحالة قبل وجود بنك: useCheckState يحمّل المواضع بمعرّف
   * البنك، وتمرير معرّف فارغ يعني حفظ مواضع تحت بنك غير موجود.
   */
  const activeBankId = currentBank?.id ?? '';

  const {
    checkData,
    setCheckData,
    positions,
    setPositions,
    prefs,
    setPrefs,
    markDateManual,
    resetPositions,
    applyPreset,
  } = useCheckState({
    bankId: activeBankId,
    language,
    defaultPositions: mergeWithDefaults(null),
    fallbackDefaults,
  });

  const { presets, createPreset, updatePreset, removePreset, renamePreset, refresh: refreshPresets } =
    usePresets({
      bankId: activeBankId,
      language,
      currentData: checkData,
      currentPositions: positions,
    });

  /*
   * موضع الشيك على الورقة: تفضيل طباعة واحد للمطابعة، تعيش هنا لا داخل
   * المعاينة حتى تستطيع واجهة الطباعة تعديله ويصل التعديل إلى زر
   * الطباعة في نفس اللحظة.
   */
  const printLayout = usePrintLayout();

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'ar' ? 'fr' : 'ar');
  }, [language, setLanguage]);

  const handleApplyPreset = useCallback(
    (preset: Preset) => {
      applyPreset(preset);
    },
    [applyPreset]
  );

  const handleSavePreset = useCallback(
    async (name: string) => {
      await createPreset(name);
    },
    [createPreset]
  );

  const handleUpdatePreset = useCallback(
    async (preset: Preset) => {
      await updatePreset(preset);
    },
    [updatePreset]
  );

  const handleRenamePreset = useCallback(
    async (preset: Preset, name: string) => {
      await renamePreset(preset, name);
    },
    [renamePreset]
  );

  /*
   * تسجيل الطباعة: يلتقط نسخة من الشيك كما كانت لحظة الطباعة.
   *
   * *_snapshot_ لازم: الشيك يُمسح ويتغير بعد الطباعة، فالتسجيل بلا نسخة
   * يصبح سطراً بلا معنى.
   */
  const handlePrint = useCallback(() => {
    const repository = getRepository();
    if (repository.addHistory === undefined || previewBank === null) return;

    const amount = Number.parseFloat(checkData.amount.replace(/\s/g, '').replace(',', '.'));
    const amountWords =
      Number.isFinite(amount)
        ? language === 'ar'
          ? numberToArabicWords(amount)
          : numberToFrenchWords(amount)
        : '';

    void repository
      .addHistory({
        bankId: activeBankId,
        bankName: previewBank.nameAr,
        language,
        data: { ...checkData },
        positions: { ...positions },
        amountWords,
        createdAt: Date.now(),
      })
      .catch((error: unknown) => console.error('[app] print history failed', error));
  }, [activeBankId, checkData, language, positions, previewBank]);

  /*
   * بعد استبدال القاعدة بأكملها، كل ما في الذاكرة ينتمي للمكتبة
   * القديمة. إعادة التحميل أرخص وأصح من محاولة مزامنة كل ذاكرة
   * الواجهة يدوياً: قالب واحد قد يكون اختفى.
   */
  const handleDatabaseReplaced = useCallback(async () => {
    releaseAllImageUrls();
    await Promise.all([refreshBanks(), refreshPresets(), refreshLabels()]);
  }, [refreshBanks, refreshPresets, refreshLabels]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gray-900 relative overflow-hidden text-gray-800 dark:text-gray-200">
      <FallbackBanner kind={engineKind} />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-200/30 dark:bg-indigo-900/40 rounded-full blur-3xl floating-animation"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-200/30 dark:bg-amber-900/40 rounded-full blur-3xl floating-animation" style={{ animationDelay: '3s' }}></div>
      </div>

      <header className="relative z-10 bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg border-b border-gray-200/80 dark:border-gray-700/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 slide-in">
              <div className="bg-[#0F7BFF] p-2 rounded-lg shadow-md">
                <img src={APP_LOGO_URL} alt="شعار التطبيق" className="w-8 h-8 object-contain" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-extrabold text-[#0F172A] dark:text-[#F5F7FA]">
                  {t('app.title')}
                </h1>
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium">
                  {t('app.subtitle')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
                <button
                  type="button"
                  id="manage-open"
                  onClick={() => setIsManageOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium"
                >
                  <Settings className="w-4 h-4" />
                  <span>{t('manage.open')}</span>
                </button>
              <button
                type="button"
                onClick={toggleDarkMode}
                aria-pressed={isDark}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-600 dark:hover:to-blue-700 text-sm font-medium transition-colors"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span>{isDark ? t('app.lightMode') : t('app.darkMode')}</span>
              </button>
                <div className="hidden md:flex items-center gap-2 bg-blue-50 dark:bg-blue-950/40 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Sparkles className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
                  <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                    {t('app.smartConversion')}
                  </span>
                </div>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label
                htmlFor="bank-select"
                className="text-sm font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap"
              >
                {t('nav.model')}
              </label>
              <select
                id="bank-select"
                onChange={(event) => setBankId(event.target.value)}
                value={activeBankId}
                disabled={isBanksLoading}
                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition disabled:opacity-60"
              >
                {isBanksLoading && <option value="">{t('nav.loading')}</option>}
                {!isBanksLoading && banks.length === 0 && <option value="">{t('nav.noBanks')}</option>}
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {language === 'ar' ? bank.nameAr : bank.nameFr}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium w-full sm:w-auto justify-center"
            >
              <Globe className="w-4 h-4" />
              <span>{language === 'ar' ? 'Français' : 'العربية'}</span>
            </button>
          </div>
        </div>
      </div>

      {previewBank === null ? (
        <main className="relative z-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <p className="text-gray-500 dark:text-gray-400">{t('nav.noBanks')}</p>
        </main>
      ) : (
        <main className="relative z-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-8 fade-in">
              <CheckForm
                checkData={checkData}
                setCheckData={setCheckData}
                onDateInput={markDateManual}
                positions={positions}
                setPositions={setPositions}
                language={language}
                showPositionControls={prefs.showPositionControls}
                onTogglePositionControls={() =>
                  setPrefs((current) => ({
                    ...current,
                    showPositionControls: !current.showPositionControls,
                  }))
                }
                presets={presets}
                onSavePreset={handleSavePreset}
                onUpdatePreset={handleUpdatePreset}
              />

              <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-3">
                  <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  {t('guide.title')}
                </h3>

                <div className="space-y-4 mb-6">
                  {(
                    [
                      ['guide.step1', 'guide.step1Body'],
                      ['guide.step2', 'guide.step2Body'],
                      ['guide.step3', 'guide.step3Body'],
                    ] as const
                  ).map(([titleKey, bodyKey], index) => (
                    <div className="flex items-start gap-4" key={titleKey}>
                      <span className="bg-gradient-to-br from-blue-600 to-yellow-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <div>
                        <h4 className="font-bold text-gray-800 dark:text-gray-100">{t(titleKey)}</h4>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">{t(bodyKey)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                  <h4 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    {t('guide.features')}
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-3 p-2 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                      <Shield className="w-5 h-5 text-blue-500" />
                      <span>{t('guide.featureSave')}</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                      <Zap className="w-5 h-5 text-green-500" />
                      <span>{t('guide.featureFast')}</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                      <Users className="w-5 h-5 text-purple-500" />
                      <span>{t('guide.featureBanks')}</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                      <Globe className="w-5 h-5 text-yellow-500" />
                      <span>{t('guide.featureLang')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="fade-in" style={{ animationDelay: '0.2s' }}>
              <CheckPreview
                checkData={checkData}
                positions={positions}
                setPositions={setPositions}
                language={language}
                bank={previewBank}
                isLocked={prefs.locked}
                onToggleLock={() => setPrefs((current) => ({ ...current, locked: !current.locked }))}
                onResetPositions={resetPositions}
                presets={presets}
                onApplyPreset={handleApplyPreset}
                onDeletePreset={removePreset}
                onRenamePreset={handleRenamePreset}
                onPrint={handlePrint}
                printLayout={printLayout.layout}
              />
            </div>
          </div>
        </main>
      )}

      {isManageOpen && (
        <ManagementPanel
          isOpen={isManageOpen}
          activeBankId={activeBankId}
          onClose={() => setIsManageOpen(false)}
          onSelectBank={setBankId}
          onBanksChanged={refreshBanks}
          onPresetsChanged={refreshPresets}
          onDatabaseReplaced={handleDatabaseReplaced}
          printLayout={printLayout}
          positions={positions}
          setPositions={setPositions}
        />
      )}

      <footer className="relative z-10 bg-[#0f172a] dark:bg-[#040816] text-white mt-16 border-t-4 border-yellow-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center text-center md:text-right gap-6">
            <div className="flex items-center gap-3">
              <img src={APP_LOGO_URL} alt="" className="w-8 h-8 object-contain" />
              <h3 className="text-lg font-bold">{t('app.title')}</h3>
            </div>
            <p className="text-gray-400 text-sm">
              {t('app.footerCredits')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
