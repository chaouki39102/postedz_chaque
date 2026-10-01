import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { useLabelProxy } from '../../context/labelsCore';
import { useLabelAdmin } from '../../hooks/useLabelAdmin';

/**
 * تحرير تسميات الواجهة.
 *
 * كل نص في التطبيق يأتي من هذا الجدول. إتاحته للتعديل تخدم غرضين:
 * تصحيح ترجمة، وتعريب شيء لم يُترجم. الحقول تحفظ عند تغيير الحقل
 * مباشرة (onBlur) لا عند الضغط على زر، لأن زر حفظ واحد مع قائمة طويلة
 * يعني نسيان الزر.
 */
const LabelsTab: React.FC = () => {
  const currentLabels = useLabelProxy('manage.');
  const { filtered, query, setQuery, isLoading, canManage, save } = useLabelAdmin();
  const [savedKey, setSavedKey] = useState<string | null>(null);

  if (!canManage) {
    return <p className="text-sm text-amber-700 dark:text-amber-300">{currentLabels.noData}</p>;
  }

  const inputClass =
    'w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 dark:text-gray-400">{currentLabels.labelsHint}</p>

      <input
        id="manage-labels-search"
        className={inputClass}
        value={query}
        placeholder={currentLabels.searchLabels}
        onChange={(event) => setQuery(event.target.value)}
      />

      {isLoading ? (
        <p className="text-sm text-gray-500">…</p>
      ) : (
        <ul className="space-y-2 max-h-96 overflow-y-auto pe-1">
          {filtered.map((label) => (
            <li
              key={label.key}
              className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-center p-2 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <code className="text-[11px] text-gray-500 dark:text-gray-400 truncate" dir="ltr">
                {label.key}
              </code>
              <input
                dir="rtl"
                aria-label={`${label.key} ar`}
                className={inputClass}
                defaultValue={label.ar}
                onBlur={(event) => {
                  if (event.target.value === label.ar) return;
                  void save(label.key, event.target.value, label.fr).then(() => setSavedKey(label.key));
                }}
              />
              <input
                dir="ltr"
                aria-label={`${label.key} fr`}
                className={inputClass}
                defaultValue={label.fr}
                onBlur={(event) => {
                  if (event.target.value === label.fr) return;
                  void save(label.key, label.ar, event.target.value).then(() => setSavedKey(label.key));
                }}
              />
              {savedKey === label.key && (
                <Check className="w-4 h-4 text-green-600" aria-label={currentLabels.saved} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LabelsTab;
