import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, ImageOff, Upload, Check, AlertTriangle } from 'lucide-react';
import { useLabelProxy } from '../../context/labelsCore';
import { useBanks } from '../../hooks/useBanks';
import { MAX_BANK_IMAGE_BYTES } from '../../constants';
import { getRepository } from '../../data';
import { acquireImageUrl, releaseImageUrl } from '../../data/imageCache';
import type { BankRecord } from '../../types';

interface BanksTabProps {
  onChanged: () => Promise<void> | void;
  onSelectBank: (id: string) => void;
}

interface Draft {
  id: string | null;
  nameAr: string;
  nameFr: string;
  isActive: boolean;
}

/** صورة مختارة مع نسخةها (هوية الروابط) لحظة الاختيار */
interface PickedImage {
  bytes: Uint8Array;
  mime: string;
  version: number;
}

const emptyDraft = (): Draft => ({ id: null, nameAr: '', nameFr: '', isActive: true });

/**
 * إدارة البنوك: إضافة، تعديل، حذف، ترتيب، وصورة الشيك.
 *
 * الصورة تُقرأ هنا في المتصفح ثم تُحفظ كـ BLOB داخل القاعدة. السبب أن
 * صورة شمسية أو مساراً محلياً لا يبقىان صالحين بعد إغلاق التطبيق أو
 * نقله إلى جهاز آخر، والقاعدة وحدها هي ما ينتقل مع المستخدم.
 */
const BanksTab: React.FC<BanksTabProps> = ({ onChanged, onSelectBank }) => {
  const currentLabels = useLabelProxy('manage.');
  const { banks, isLoading, canManage, refresh, createBank, updateBank, deleteBank, reorder } = useBanks();

  const [allBanks, setAllBanks] = useState<readonly BankRecord[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [image, setImage] = useState<PickedImage | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /*
   * القائمة هنا تشمل البنوك المعطّلة أيضاً، بخلاف قائمة الاختيار في
   * الشاشة. بنك معطّل ما زال بيانات (اسم وصورة ومواضع)، وإخفاؤه عن
   * الإدارة يجعل استرجاعه مستحيلاً إلا باستيراد نسخة احتياطية.
   */
  const loadAll = useCallback(async (): Promise<BankRecord[]> => {
    const repository = getRepository();
    if (!repository.listBanks) {
      setAllBanks([]);
      return [];
    }
    const all = await repository.listBanks(true);
    setAllBanks(all);
    return all;
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const selected = useMemo(
    () => allBanks.find((bank) => bank.id === draft.id) ?? null,
    [allBanks, draft.id]
  );

  /*
   * معاينة الصورة المختارة: نفس آلية imageCache المستعملة في الشاشة
   * الرئيسية، فلا يُبطَل أي رابط مستعمل في المعاينة الكبيرة.
   *
   * `version` يُلتقط لحظة الاختيار لا عند العرض: هو جزء من هوية الصورة
   * في ذاكرة الروابط، فلو حُسب عند كل عرض لتغيّر المفتاح وفشل الإبطال.
   */
  useEffect(() => {
    if (image !== null) {
      const url = acquireImageUrl('manage-draft', image.version, image.bytes, image.mime, null);
      setPreviewUrl(url);
      return () => releaseImageUrl(`manage-draft@${image.version}`);
    }

    if (selected !== null && selected.imageBytes !== null) {
      const url = acquireImageUrl(
        selected.id,
        selected.updatedAt,
        selected.imageBytes,
        selected.imageMime,
        selected.imageSeed
      );
      setPreviewUrl(url);
      return () => releaseImageUrl(`${selected.id}@${selected.updatedAt}`);
    }

    setPreviewUrl(null);
    return undefined;
  }, [image, selected]);

  const startEdit = (bank: BankRecord) => {
    setDraft({ id: bank.id, nameAr: bank.nameAr, nameFr: bank.nameFr, isActive: bank.isActive });
    setImage(null);
    setRemoveImage(false);
    setError(null);
  };

  const startCreate = () => {
    setDraft(emptyDraft());
    setImage(null);
    setRemoveImage(false);
    setError(null);
  };

  const onPickImage = async (file: File | undefined) => {
    if (file === undefined) return;
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError(currentLabels.imageInvalid);
      return;
    }
    if (file.size > MAX_BANK_IMAGE_BYTES) {
      setError(currentLabels.imageTooLarge);
      return;
    }

    setImage({
      bytes: new Uint8Array(await file.arrayBuffer()),
      mime: file.type,
      version: Date.now(),
    });
    setRemoveImage(false);
  };

  const submit = async () => {
    setError(null);
    let createdName: string | null = null;

    if (draft.nameAr.trim() === '' && draft.nameFr.trim() === '') {
      setError(currentLabels.nameRequired);
      return;
    }

    setIsBusy(true);
    try {
      if (draft.id === null) {
        const nameAr = draft.nameAr.trim();
        await createBank({
          nameAr,
          nameFr: draft.nameFr.trim() === '' ? nameAr : draft.nameFr.trim(),
          imageBytes: image?.bytes ?? null,
          imageMime: image?.mime ?? null,
        });
        // بنك جديد بلا نموذج: لا معنى لإنشائه ثم البقاء على بنك آخر
        createdName = nameAr;
      } else {
        await updateBank({
          id: draft.id,
          nameAr: draft.nameAr.trim(),
          nameFr: draft.nameFr.trim() === '' ? draft.nameAr.trim() : draft.nameFr.trim(),
          isActive: draft.isActive,
          // الحقول الاختيارية:غيابها يعني "لا تغيّر الصورة"
          ...(image === null && removeImage
            ? { imageBytes: null, imageMime: null }
            : image !== null
              ? { imageBytes: image.bytes, imageMime: image.mime }
              : {}),
        });
      }

      await refresh();
      const fresh = await loadAll();
      await onChanged();

      /*
       * بنك جديد: ننقل الاختيار إليه. بدون ذلك يبقى المستخدم على بنك
       * آخر بعد أن أنشأ بنكاً — تعديل بلا أثر مرئي.
       */
      if (createdName !== null) {
        const created = fresh.find((item) => item.nameAr === createdName);
        if (created !== undefined) onSelectBank(created.id);
      }

      startCreate();
    } catch (caught) {
      console.error('[manage] bank save failed', caught);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsBusy(false);
    }
  };

  const remove = async (bank: BankRecord) => {
    if (!window.confirm(currentLabels.deleteConfirm)) return;

    setIsBusy(true);
    try {
      await deleteBank(bank.id);
      if (draft.id === bank.id) startCreate();
      await loadAll();
      await onChanged();
    } catch (caught) {
      console.error('[manage] bank delete failed', caught);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsBusy(false);
    }
  };

  const move = async (bank: BankRecord, direction: -1 | 1) => {
    const ids = allBanks.map((item) => item.id);
    const index = ids.indexOf(bank.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;

    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];

    setIsBusy(true);
    try {
      await reorder(next);
      await loadAll();
      await onChanged();
    } finally {
      setIsBusy(false);
    }
  };

  if (!canManage) {
    return <p className="text-sm text-amber-700 dark:text-amber-300">{currentLabels.noData}</p>;
  }

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 dark:text-white">{currentLabels.editBank}</h3>
            <button
              type="button"
              onClick={startCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              {currentLabels.addBank}
            </button>
          </div>

          <div>
            <label htmlFor="manage-bank-ar" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              {currentLabels.bankNameAr}
            </label>
            <input
              id="manage-bank-ar"
              className={inputClass}
              value={draft.nameAr}
              onChange={(event) => setDraft((current) => ({ ...current, nameAr: event.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="manage-bank-fr" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              {currentLabels.bankNameFr}
            </label>
            <input
              id="manage-bank-fr"
              className={inputClass}
              value={draft.nameFr}
              onChange={(event) => setDraft((current) => ({ ...current, nameFr: event.target.value }))}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              id="manage-bank-active"
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) =>
                setDraft((current) => ({ ...current, isActive: event.target.checked }))
              }
            />
            {currentLabels.isActive}
          </label>

          <div>
            <span className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              {currentLabels.bankImage}
            </span>
            <div className="flex items-center gap-3">
              <div className="w-28 h-16 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                {previewUrl === null ? (
                  <ImageOff className="w-5 h-5 text-gray-400" />
                ) : (
                  <img src={previewUrl} alt="" className="w-full h-full object-contain" />
                )}
              </div>
              <input
                ref={fileInputRef}
                id="manage-bank-image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  void onPickImage(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Upload className="w-4 h-4" />
                {currentLabels.replaceImage}
              </button>
              <button
                type="button"
                onClick={() => {
                  setImage(null);
                  setRemoveImage(true);
                }}
                disabled={image === null && !removeImage}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                <ImageOff className="w-4 h-4" />
                {currentLabels.removeImage}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{currentLabels.imageHint}</p>
          </div>

          {error !== null && (
            <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              id="manage-bank-save"
              onClick={() => void submit()}
              disabled={isBusy}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {currentLabels.save}
            </button>
            {draft.id !== null && (
              <button
                type="button"
                onClick={startCreate}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {currentLabels.cancel}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-bold text-gray-900 dark:text-white">
            {currentLabels.banksTab} ({allBanks.length})
          </h3>

          {isLoading && <p className="text-sm text-gray-500">{currentLabels.noBanks}</p>}
          {!isLoading && allBanks.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{currentLabels.noBanks}</p>
          )}

          <ul id="manage-bank-list" className="space-y-1 max-h-96 overflow-y-auto pe-1">
            {allBanks.map((bank, index) => (
              <li
                key={bank.id}
                data-bank-id={bank.id}
                className={`flex items-center gap-2 p-2 rounded-lg border ${
                  draft.id === bank.id
                    ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => startEdit(bank)}
                  className="flex-1 text-start text-sm text-gray-800 dark:text-gray-200 truncate"
                >
                  {bank.isActive ? '' : '✕ '}
                  {bank.nameAr}
                  {bank.isBuiltin ? ` · ${currentLabels.builtin}` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => void move(bank, -1)}
                  disabled={index === 0 || isBusy}
                  aria-label={currentLabels.moveUp}
                  className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void move(bank, 1)}
                  disabled={index === allBanks.length - 1 || isBusy}
                  aria-label={currentLabels.moveDown}
                  className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void remove(bank)}
                  disabled={isBusy}
                  aria-label={`${currentLabels.delete}: ${bank.nameAr}`}
                  className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {currentLabels.isActive}: {banks.length} / {allBanks.length}
      </p>
    </div>
  );
};

export default BanksTab;
