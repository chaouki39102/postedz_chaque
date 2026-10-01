import { useCallback, useEffect, useState } from 'react';
import { getRepository } from '../data';
import type { CheckData, Language, PositionMap, Preset } from '../types';

/** توليد معرّف فريد يدعم المتصفحات القديمة بدون crypto.randomUUID */
const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const defaultPresetName = (language: Language): string =>
  language === 'ar' ? 'قالب بدون اسم' : 'Modèle sans nom';

interface UsePresetsParams {
  bankId: string;
  language: Language;
  /** القالب المرجعي عند "حفظ كقالب جديد" */
  currentData: CheckData;
  currentPositions: PositionMap;
}

interface UsePresets {
  presets: Preset[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  /** يحفظ قالباً جديداً أو يحدّث قالباً موجوداً بنفس المعرّف */
  createPreset: (name: string) => Promise<Preset>;
  updatePreset: (preset: Preset) => Promise<void>;
  /** يغيّر الاسم فقط، بلا مساس بالبيانات المخزَّنة */
  renamePreset: (preset: Preset, name: string) => Promise<void>;
  loadPreset: (preset: Preset) => { data: CheckData; positions: PositionMap };
  removePreset: (id: string) => Promise<void>;
}

/** مكتبة القوالب المحفوظة. كل قالب مرتبط بنموذج بنك واحد. */
export const usePresets = ({
  bankId,
  language,
  currentData,
  currentPositions,
}: UsePresetsParams): UsePresets => {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const all = await getRepository().listPresets();
      setPresets(all.filter((preset) => preset.bankId === bankId));
    } catch (error) {
      console.warn('[presets] load failed', error);
      setPresets([]);
    } finally {
      setIsLoading(false);
    }
  }, [bankId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createPreset = useCallback(
    async (name: string) => {
      const now = Date.now();
      const trimmed = name.trim();

      const preset: Preset = {
        id: createId(),
        name: trimmed || defaultPresetName(language),
        bankId,
        language,
        data: { ...currentData },
        positions: { ...currentPositions },
        createdAt: now,
        updatedAt: now,
      };

      await getRepository().savePreset(preset);
      await refresh();
      return preset;
    },
    [bankId, currentData, currentPositions, language, refresh]
  );

  const updatePreset = useCallback(
    async (preset: Preset) => {
      await getRepository().savePreset({
        ...preset,
        data: { ...currentData },
        positions: { ...currentPositions },
        updatedAt: Date.now(),
      });
      await refresh();
    },
    [currentData, currentPositions, refresh]
  );

  /*
   * إعادة التسمية لا تمرّ من updatePreset: تلك تكتب بيانات الشيك
   * الحالية على القالب، وهذا يعني أن تعديل الاسم على بنك آخر يمسح
   * ما خزّنه المستخدم. هنا نكتب القالب كما هو باسم جديد فقط.
   */
  const renamePreset = useCallback(
    async (preset: Preset, name: string) => {
      const trimmed = name.trim();
      if (trimmed === '' || trimmed === preset.name) return;

      await getRepository().savePreset({
        ...preset,
        name: trimmed,
        updatedAt: Date.now(),
      });
      await refresh();
    },
    [refresh]
  );

  const loadPreset = useCallback(
    (preset: Preset) => ({
      data: { ...preset.data },
      positions: { ...preset.positions },
    }),
    []
  );

  const removePreset = useCallback(
    async (id: string) => {
      await getRepository().deletePreset(id);
      await refresh();
    },
    [refresh]
  );

  return { presets, isLoading, refresh, createPreset, updatePreset, renamePreset, loadPreset, removePreset };
};
