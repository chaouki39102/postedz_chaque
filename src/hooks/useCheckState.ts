import { useCallback, useEffect, useRef, useState } from 'react';
import { getRepository } from '../data';
import { DEFAULT_UI_PREFS } from '../data/repository';
import { mergeWithDefaults } from '../banksData';
import { toLocalDateInputValue } from '../utils/date';
import type { CheckData, Language, PositionMap, Preset, StoredCheckData, UiPrefs } from '../types';

interface UseCheckStateOptions {
  bankId: string;
  language: Language;
  /** المواضع الافتراضية عند عدم وجود حفظ */
  defaultPositions: PositionMap;
  /**
   * القيم الافتراضية للحقول عند تعذّر قراءة القاعدة.
   *
   * المحرك الاحتياطي (localStorage) لا يعرف جدول field_defaults، وهذا
   * هو مصدره الوحيد. عند توفّر الجدول تُقرأ القيم من القاعدة ويُهمل هذا.
   */
  fallbackDefaults: (language: Language) => Omit<CheckData, 'date'>;
}

export interface CheckState {
  isReady: boolean;
  checkData: CheckData;
  positions: PositionMap;
  prefs: UiPrefs;
  setCheckData: (updater: (current: CheckData) => CheckData) => void;
  setPositions: (updater: (current: PositionMap) => PositionMap) => void;
  setPrefs: (updater: (current: UiPrefs) => UiPrefs) => void;
  markDateManual: () => void;
  resetPositions: () => void;
  applyPreset: (preset: Preset) => void;
}

/**
 * يؤخّر تنفيذ الدالة حتى تتوقف الاستدعاءات (منع الكتابة على التخزين عند كل ضغطة مفتاح).
 * يحافظ على هوية الدالة عبر العرضات باستخدام useRef.
 */
const useDebounced = <A extends unknown[]>(fn: (...args: A) => void, delay: number) => {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (...args: A) => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        fnRef.current(...args);
      }, delay);
    },
    [delay]
  );
};

/**
 * يدير حالة التطبيق ويحمّلها/يحفظها عبر مستودع التخزين.
 *
 * لماذا هذا التركيب:
 * - الحفظ مؤجّل لتقليل الكتابات.
 * - `readyRef` يمنع الحفظ قبل اكتمال التحميل، وإلا كُتبت مواضع البنك
 *   الجديد فوق مواضع البنك القديم المحفوظة.
 * - `scope` يمنع حفظ مواضع بنك/لغة أخرى أثناء الانتقال بينها.
 */
export const useCheckState = ({
  bankId,
  language,
  defaultPositions,
  fallbackDefaults,
}: UseCheckStateOptions): CheckState => {
  const repository = getRepository();
  const scopeKey = `${bankId}:${language}`;

  const [isReady, setIsReady] = useState(false);
  const [checkData, setCheckDataState] = useState<CheckData>(() => ({
    date: toLocalDateInputValue(),
    ...fallbackDefaults(language),
  }));
  const [positions, setPositionsState] = useState<PositionMap>(defaultPositions);
  const [prefs, setPrefsState] = useState<UiPrefs>(DEFAULT_UI_PREFS);
  const [scope, setScope] = useState('');

  const dateIsAutoRef = useRef(true);

  const defaultPositionsRef = useRef(defaultPositions);
  defaultPositionsRef.current = defaultPositions;
  const defaultsRef = useRef(fallbackDefaults);
  defaultsRef.current = fallbackDefaults;

  // ---- التحميل ----
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      /*
       * القيم الافتراضية تُقرأ من القاعدة مع بقية البيانات. هي جزء من
       * البيانات لا من الكود: تغييرها لا يتطلب بناء نسخة جديدة.
       */
      const storedDefaults = repository.loadFieldDefaults
        ? await repository.loadFieldDefaults(language).catch(() => null)
        : null;

      const [loadedData, loadedPrefs, loadedPositions] = await Promise.all([
        repository.loadCheckData(),
        repository.loadUiPrefs(),
        repository.loadPositions(bankId, language),
      ]);

      if (cancelled) return;

      const defaults = storedDefaults ?? {
        date: toLocalDateInputValue(),
        dateIsAuto: true,
        ...defaultsRef.current(language),
      };

      setCheckDataState({
        date: loadedData && !loadedData.dateIsAuto ? loadedData.date : defaults.date,
        place: loadedData?.place ?? defaults.place,
        beneficiary: loadedData?.beneficiary ?? defaults.beneficiary,
        amount: loadedData?.amount ?? defaults.amount,
      });

      // التاريخ الآلي يعني: القيمة قادمة من القاعدة، لا من المستخدم
      dateIsAutoRef.current = loadedData ? loadedData.dateIsAuto : defaults.dateIsAuto;
      setPrefsState(loadedPrefs);
      /*
       * المواضع تُدمج مع الافتراضية دائماً، لا عند غيابها فقط.
       *
       * القاعدة قد تحوي صفاً لحقل واحد فقط (المستخدم حرّك التاريخ
       * وحده)، فالمصفوفة المحمَّلة ناقصة. تمريرها كما هي يعني أن كل
       * من يضبط حقلاً غائباً يبني `{...current[field], fontCqw}` فتصير
       * `{fontCqw}` بلا x ولا y، ويرفض sql.js ربط undefined فيرفض
       * الحفظ كله. الدمج هنا يمنع ولود مثل هذه المصفوفة أصلاً.
       */
      setPositionsState(mergeWithDefaults(loadedPositions, defaultPositionsRef.current));
      setScope(scopeKey);
      setIsReady(true);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [scopeKey, bankId, language, repository]);

  // ---- الحفظ المؤجّل ----
  const flushData = useDebounced((value: StoredCheckData) => {
    void repository.saveCheckData(value);
  }, 250);

  const flushPositions = useDebounced(
    (targetBankId: string, targetLanguage: Language, value: PositionMap) => {
      void repository.savePositions(targetBankId, targetLanguage, value);
    },
    250
  );

  const flushPrefs = useDebounced((value: UiPrefs) => {
    void repository.saveUiPrefs(value);
  }, 150);

  useEffect(() => {
    if (!isReady) return;
    flushData({ ...checkData, dateIsAuto: dateIsAutoRef.current });
  }, [checkData, isReady, flushData]);

  useEffect(() => {
    // لا نحفظ ما لم يُحمّل بعد، ولا أثناء الانتقال بين بنك/لغة
    if (!isReady || scope !== scopeKey) return;
    flushPositions(bankId, language, positions);
  }, [positions, isReady, scope, scopeKey, bankId, language, flushPositions]);

  useEffect(() => {
    if (!isReady) return;
    flushPrefs(prefs);
  }, [prefs, isReady, flushPrefs]);

  // ---- الأوامر ----
  const setCheckData = useCallback((updater: (current: CheckData) => CheckData) => {
    setCheckDataState(updater);
  }, []);

  const setPositions = useCallback((updater: (current: PositionMap) => PositionMap) => {
    setPositionsState(updater);
  }, []);

  const setPrefs = useCallback((updater: (current: UiPrefs) => UiPrefs) => {
    setPrefsState(updater);
  }, []);

  const markDateManual = useCallback(() => {
    dateIsAutoRef.current = false;
  }, []);

  const resetPositions = useCallback(() => {
    setPositionsState({ ...defaultPositionsRef.current });
    void repository.resetPositions(bankId, language);
  }, [bankId, language, repository]);

  /**
   * يطبّق قالباً محفوظاً: بيانات الشيك + المواضع معاً.
   * تاريخ القالب يُعتبر يدوياً حتى لا يستبدله تاريخ اليوم.
   */
  const applyPreset = useCallback((preset: Preset) => {
    dateIsAutoRef.current = false;
    setCheckDataState({ ...preset.data });
    setPositionsState({ ...preset.positions });
  }, []);

  return {
    isReady,
    checkData,
    positions,
    prefs,
    setCheckData,
    setPositions,
    setPrefs,
    markDateManual,
    resetPositions,
    applyPreset,
  };
};
