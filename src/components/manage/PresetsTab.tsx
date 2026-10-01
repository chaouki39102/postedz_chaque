import React, { useCallback, useEffect, useState } from 'react';
import { Trash2, Check, X, Play } from 'lucide-react';
import { useLabelProxy } from '../../context/labelsCore';
import { getRepository } from '../../data';
import type { Preset } from '../../types';

interface PresetsTabProps {
  activeBankId: string;
  onChanged: () => Promise<void> | void;
}

/**
 * إدارة القوالب المحفوظة لكل البنوك.
 *
 * القائمة الكاملة (لا لبنك واحد) مقصودة: القالب المحذوف بالخطأ لا
 * يمكن استرجاعه إن كان مخفياً خلف بنك واحد في كل مرة.
 */
const PresetsTab: React.FC<PresetsTabProps> = ({ activeBankId, onChanged }) => {
  const currentLabels = useLabelProxy('manage.');
  const [presets, setPresets] = useState<Preset[]>([]);
  const [bankNames, setBankNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const load = useCallback(async () => {
    const repository = getRepository();
    setIsLoading(true);
    try {
      const [all, banks] = await Promise.all([
        repository.listPresets(),
        repository.listBanks ? repository.listBanks(true) : Promise.resolve([]),
      ]);

      setPresets(all);
      setBankNames(
        Object.fromEntries(banks.map((bank) => [bank.id, bank.nameAr]))
      );
    } catch (error) {
      console.error('[manage] presets load failed', error);
      setPresets([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const commitRename = async (preset: Preset) => {
    const name = draftName.trim();
    if (name === '' || name === preset.name) {
      setEditingId(null);
      return;
    }

    /*
     * إعادة التسمية لا تستعمل updatePreset (التي تعيد كتابة البيانات
     * الحالية على القالب): إعادة التسمية تغيّر الاسم فقط.
     */
    await getRepository().savePreset({ ...preset, name, updatedAt: Date.now() });
    setEditingId(null);
    await load();
    await onChanged();
  };

  const remove = async (preset: Preset) => {
    if (!window.confirm(currentLabels.presetDeleteConfirm)) return;
    await getRepository().deletePreset(preset.id);
    await load();
    await onChanged();
  };

  if (isLoading) return <p className="text-sm text-gray-500">…</p>;

  if (presets.length === 0) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {currentLabels.presetsHint}
      </p>
    );
  }

  const inputClass =
    'flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700';

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 dark:text-gray-400">{currentLabels.presetsHint}</p>

      <ul id="manage-preset-list" className="space-y-2">
        {presets.map((preset) => (
          <li
            key={preset.id}
            className={`flex flex-wrap items-center gap-2 p-2 rounded-lg border ${
              preset.bankId === activeBankId
                ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            {editingId === preset.id ? (
              <>
                <input
                  id={`manage-preset-name-${preset.id}`}
                  className={inputClass}
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void commitRename(preset);
                    if (event.key === 'Escape') setEditingId(null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => void commitRename(preset)}
                  aria-label={currentLabels.save}
                  className="p-1.5 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  aria-label={currentLabels.cancel}
                  className="p-1.5 rounded text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">
                  {preset.name}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {' '}
                    · {bankNames[preset.bankId] ?? preset.bankId}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(preset.id);
                    setDraftName(preset.name);
                  }}
                  aria-label={`${currentLabels.presetRename}: ${preset.name}`}
                  className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {currentLabels.rename}
                </button>
                {preset.bankId === activeBankId && (
                  <span
                    className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 dark:text-indigo-300"
                    title={currentLabels.presetApply}
                  >
                    <Play className="w-3 h-3" />
                    {currentLabels.presetApply}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void remove(preset)}
                  aria-label={`${currentLabels.presetDelete}: ${preset.name}`}
                  className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PresetsTab;
