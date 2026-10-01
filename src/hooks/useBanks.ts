import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRepository } from '../data';
import { acquireImageUrl, bankKey, releaseImageUrl } from '../data/imageCache';
import { mergeWithDefaults } from '../banksData';
import type { Bank, BankRecord, Language, PositionMap } from '../types';

/**
 * حالة البنوك.
 *
 * البنك كيان في قاعدة البيانات، لا ثابت في الكود. هذا الـ hook هو
 * الحدّ الفاصل: يقرأ السجلات، ويحوّل بايتات الصورة إلى رابط صالح
 * للعرض عبر imageCache (المسؤول عن الإبطال).
 */

export interface BanksApi {
  banks: readonly Bank[];
  /** بنك واحد، أو null إن لم يوجد */
  getBank: (id: string) => Bank | null;
  isLoading: boolean;
  /** يعيد تحميل القائمة (بعد إضافة/حذف/ترتيب) */
  refresh: () => Promise<void>;
  createBank: (input: {
    nameAr: string;
    nameFr: string;
    imageBytes: Uint8Array | null;
    imageMime: string | null;
  }) => Promise<void>;
  updateBank: (input: {
    id: string;
    nameAr: string;
    nameFr: string;
    isActive: boolean;
    imageBytes?: Uint8Array | null;
    imageMime?: string | null;
  }) => Promise<void>;
  deleteBank: (id: string) => Promise<void>;
  reorder: (orderedIds: readonly string[]) => Promise<void>;
  /** هل يدعم المحرك إدارة البنوك؟ (لا في وضع التخزين المحدود) */
  canManage: boolean;
}

/**
 * يبني كائن العرض للبنك من السجل.
 *
 * `imageUrl` يُترك null هنا عن قصد: القائمة تعرض الأسماء فقط، ولا
 * يحتاج أي رابط صورة إلا البنك المعروض في المعاينة. إنشاء 19 رابطاً
 * blob لقائمة لا تُعرض صورها إلا مورد بلا فائدة.
 */
const toDisplayBank = (record: BankRecord): Bank => ({
  ...record,
  imageUrl: null,
  // المواضع الافتراضية هنا؛ المواضع المحفوظة تحمّلها useBankPositions
  initialPositions: {
    ar: mergeWithDefaults(null),
    fr: mergeWithDefaults(null),
  },
});

export const useBanks = (): BanksApi => {
  const [records, setRecords] = useState<readonly BankRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);

  const refresh = useCallback(async () => {
    const repository = getRepository();

    if (!repository.listBanks) {
      setRecords([]);
      setCanManage(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      setRecords(await repository.listBanks(true));
      setCanManage(true);
    } catch (error) {
      console.error('[banks] load failed', error);
      setRecords([]);
      setCanManage(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /*
   * القائمة لا تحمل روابط صور: banksToDisplay خالصة من ذاكرة الصور،
   * فلا يتأثر رسم القائمة بتغيير صورة بنك.
   */
  const banks = useMemo<readonly Bank[]>(
    () => records.filter((record) => record.isActive).map(toDisplayBank),
    [records]
  );

  const getBank = useCallback(
    (id: string): Bank | null => banks.find((bank) => bank.id === id) ?? null,
    [banks]
  );

  const createBank = useCallback<BanksApi['createBank']>(
    async (input) => {
      const repository = getRepository();
      if (!repository.saveBank) throw new Error('bank management unavailable');
      await repository.saveBank({ ...input });
      await refresh();
    },
    [refresh]
  );

  const updateBank = useCallback<BanksApi['updateBank']>(
    async (input) => {
      const repository = getRepository();
      if (!repository.saveBank) throw new Error('bank management unavailable');
      await repository.saveBank(input);
      await refresh();
    },
    [refresh]
  );

  const deleteBank = useCallback<BanksApi['deleteBank']>(
    async (id) => {
      const repository = getRepository();
      if (!repository.deleteBank) throw new Error('bank management unavailable');
      await repository.deleteBank(id);
      await refresh();
    },
    [refresh]
  );

  const reorder = useCallback<BanksApi['reorder']>(
    async (orderedIds) => {
      const repository = getRepository();
      if (!repository.reorderBanks) throw new Error('bank management unavailable');
      await repository.reorderBanks(orderedIds);
      await refresh();
    },
    [refresh]
  );

  return {
    banks,
    getBank,
    isLoading,
    refresh,
    createBank,
    updateBank,
    deleteBank,
    reorder,
    canManage,
  };
};

/**
 * رابط صورة البنك المعروض.
 *
 * دورة حياة صريحة: نكتسب الرابط في useEffect ونحرّره في تنظيفه. هذا
 * يضمن إبطال object URL عند مغادرة البنك أو تغيير صورته، لا بعده.
 *
 * البايتات في مرجع لأنها هوية جديدة في كل قراءة للقاعدة؛ الاعتماد على
 * `bankId@updatedAt` يعني تشغيلاً واحداً لكل نسخة صورة فعلاً، لا لكل
 * جلب.
 */
export const useBankImageUrl = (bank: BankRecord | null): string | null => {
  const [url, setUrl] = useState<string | null>(null);

  // نقرأ البايتات من مرجع حتى لا تجعل التأثير يعاد بناؤه بلا داعٍ
  const recordRef = useRef(bank);
  recordRef.current = bank;

  const version = bank === null ? '' : bankKey(bank.id, bank.updatedAt);

  useEffect(() => {
    const current = recordRef.current;
    if (current === null) {
      setUrl(null);
      return undefined;
    }

    const key = bankKey(current.id, current.updatedAt);
    const acquired = acquireImageUrl(
      current.id,
      current.updatedAt,
      current.imageBytes,
      current.imageMime,
      current.imageSeed
    );
    setUrl(acquired);

    return () => {
      if (current.imageBytes === null) return; // مسار البذرة لا يُبطَل
      releaseImageUrl(key);
    };
  }, [version]);

  return url;
};

/** يحمّل مواضع بنك من قاعدة البيانات (مع دمج الافتراضي) */export const useBankPositions = (
  repository: ReturnType<typeof getRepository>,
  bankId: string,
  language: Language
): { positions: PositionMap; isLoading: boolean } => {
  const [positions, setPositions] = useState<PositionMap>(() => mergeWithDefaults(null));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    void repository
      .loadPositions(bankId, language)
      .then((saved) => {
        if (!cancelled) setPositions(mergeWithDefaults(saved));
      })
      .catch((error) => {
        console.error('[positions] load failed', error);
        if (!cancelled) setPositions(mergeWithDefaults(null));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [repository, bankId, language]);

  return { positions, isLoading };
};
