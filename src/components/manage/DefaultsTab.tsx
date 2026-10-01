import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useLabelProxy, useLabels } from '../../context/labelsCore';
import { useFieldDefaults } from '../../hooks/useFieldDefaults';
import { TODAY } from '../../data/fieldDefaults';

/**
 * تحرير القيم الافتراضية للحقول.
 *
 * هذه القيم تُستعمل عندما لا يكون هناك شيك محفوظ، أي في أول زيارة.
 * لذلك تعديلها هنا يغيّر ما يراه المستخدم الجديد، لا ما كتبه المستخدم
 * الحالي — وهذا فرق مهم، ولهذا وُضعت في جدول لا في الكود.
 */
const DefaultsTab: React.FC = () => {
  const currentLabels = useLabelProxy('manage.');
  const { language, setLanguage } = useLabels();
  const { values, isLoading, canManage, isSaved, save } = useFieldDefaults(language);

  const [place, setPlace] = useState('');
  const [beneficiary, setBeneficiary] = useState('');
  const [amount, setAmount] = useState('');
  const [isDateToday, setIsDateToday] = useState(true);
  const [fixedDate, setFixedDate] = useState('');

  useEffect(() => {
    if (values === null) return;
    setPlace(values.place);
    setBeneficiary(values.beneficiary);
    setAmount(values.amount);
    setIsDateToday(values.dateIsAuto);
    setFixedDate(values.dateIsAuto ? '' : values.date);
  }, [values]);

  if (!canManage) {
    return <p className="text-sm text-amber-700 dark:text-amber-300">{currentLabels.noData}</p>;
  }

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500';

  const onSubmit = async () => {
    await save({
      place,
      beneficiary,
      amount,
      // القيمة المخزَّنة عند اختيار "اليوم" هي العلامة لا تاريخ
      date: isDateToday ? TODAY : fixedDate,
    });
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm text-gray-600 dark:text-gray-400">{currentLabels.defaultsHint}</p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setLanguage('ar')}
          aria-pressed={language === 'ar'}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
            language === 'ar'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          العربية
        </button>
        <button
          type="button"
          onClick={() => setLanguage('fr')}
          aria-pressed={language === 'fr'}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
            language === 'fr'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          Français
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">…</p>
      ) : (
        <div className="space-y-3">
          <div>
            <label htmlFor="manage-default-place" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              {currentLabels.defaultPlace}
            </label>
            <input
              id="manage-default-place"
              className={inputClass}
              value={place}
              onChange={(event) => setPlace(event.target.value)}
            />
          </div>

          <div>
            <label htmlFor="manage-default-beneficiary" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              {currentLabels.defaultBeneficiary}
            </label>
            <input
              id="manage-default-beneficiary"
              className={inputClass}
              value={beneficiary}
              onChange={(event) => setBeneficiary(event.target.value)}
            />
          </div>

          <div>
            <label htmlFor="manage-default-amount" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              {currentLabels.defaultAmount}
            </label>
            <input
              id="manage-default-amount"
              className={inputClass}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
            />
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-gray-600 dark:text-gray-300">
              {currentLabels.defaultDate}
            </span>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                id="manage-default-date-today"
                type="radio"
                checked={isDateToday}
                onChange={() => setIsDateToday(true)}
              />
              {currentLabels.dateToday}
            </label>
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                id="manage-default-date-fixed"
                type="radio"
                checked={!isDateToday}
                onChange={() => setIsDateToday(false)}
              />
              <span>{currentLabels.dateFixed}</span>
              <input
                id="manage-default-date-value"
                type="date"
                className={inputClass}
                value={fixedDate}
                disabled={isDateToday}
                onChange={(event) => setFixedDate(event.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            id="manage-defaults-save"
            onClick={() => void onSubmit()}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <Check className="w-4 h-4" />
            {isSaved ? currentLabels.saved : currentLabels.save}
          </button>
        </div>
      )}
    </div>
  );
};

export default DefaultsTab;
