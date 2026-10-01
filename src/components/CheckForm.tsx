import React, { useCallback, useState } from 'react';
import { Calendar, MapPin, User, DollarSign, Settings, Sparkles, Bookmark, Save } from 'lucide-react';
import type { CheckData, PositionMap, Language, Preset } from '../types';
import { MAX_AMOUNT } from '../constants';
import { useLabelProxy, useLabels } from '../context/labelsCore';

/** حدود عرض نص المبلغ بالحروف (نسبة مئوية من عرض الشيك) */
const MIN_WIDTH_PERCENT = 10;
const MAX_WIDTH_PERCENT = 95;
const DEFAULT_WIDTH_PERCENT = 50;

const clampWidthPercent = (value: number | undefined): number => {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_WIDTH_PERCENT;
  return Math.min(MAX_WIDTH_PERCENT, Math.max(MIN_WIDTH_PERCENT, value));
};

interface CheckFormProps {
  checkData: CheckData;
  setCheckData: (updater: (current: CheckData) => CheckData) => void;
  onDateInput: () => void;
  positions: PositionMap;
  setPositions: (updater: (current: PositionMap) => PositionMap) => void;
  language: Language;
  showPositionControls: boolean;
  onTogglePositionControls: () => void;
  presets: Preset[];
  onSavePreset: (name: string) => Promise<void>;
  onUpdatePreset: (preset: Preset) => Promise<void>;
}

type PositionField = 'date' | 'place' | 'beneficiary' | 'amount';

/** لون مميّز لكل حقل، يُستخدم في لوحة التحكم والمواضع */
const FIELD_THEME: Record<PositionField, {
  panel: string;
  dot: string;
  heading: string;
  input: string;
}> = {
  date: {
    panel: 'from-blue-50 to-yellow-50 border-blue-100 dark:from-blue-900/20 dark:to-yellow-900/20 dark:border-blue-800',
    dot: 'text-blue-600 dark:text-blue-400',
    heading: 'text-blue-800 dark:text-blue-200',
    input: 'border-blue-200 focus:border-blue-500 dark:border-blue-700 dark:focus:border-blue-400',
  },
  place: {
    panel: 'from-green-50 to-emerald-50 border-green-100 dark:from-green-900/20 dark:to-emerald-900/20 dark:border-green-800',
    dot: 'text-green-600 dark:text-green-400',
    heading: 'text-green-800 dark:text-green-200',
    input: 'border-green-200 focus:border-green-500 dark:border-green-700 dark:focus:border-green-400',
  },
  beneficiary: {
    panel: 'from-purple-50 to-pink-50 border-purple-100 dark:from-purple-900/20 dark:to-pink-900/20 dark:border-purple-800',
    dot: 'text-purple-600 dark:text-purple-400',
    heading: 'text-purple-800 dark:text-purple-200',
    input: 'border-purple-200 focus:border-purple-500 dark:border-purple-700 dark:focus:border-purple-400',
  },
  amount: {
    panel: 'from-yellow-50 to-orange-50 border-yellow-100 dark:from-yellow-900/20 dark:to-orange-900/20 dark:border-yellow-800',
    dot: 'text-yellow-600 dark:text-yellow-400',
    heading: 'text-yellow-800 dark:text-yellow-200',
    input: 'border-yellow-200 focus:border-yellow-500 dark:border-yellow-700 dark:focus:border-yellow-400',
  },
};

/** مفتاح تسمية كل حقل موضع، في جدول labels */
const FIELD_LABEL_KEYS: Record<PositionField, string> = {
  date: 'form.fieldDate',
  place: 'form.fieldPlace',
  beneficiary: 'form.fieldBeneficiary',
  amount: 'form.fieldAmount',
};

const INPUT_BASE =
  'w-full px-3 md:px-4 py-2.5 md:py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 transition-all duration-300 text-sm font-medium bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm mobile-input dark:text-white';

const CheckForm: React.FC<CheckFormProps> = ({
  checkData,
  setCheckData,
  onDateInput,
  positions,
  setPositions,
  language,
  showPositionControls,
  onTogglePositionControls,
  presets,
  onSavePreset,
  onUpdatePreset,
}) => {
  const [presetName, setPresetName] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);

  // النصوص تأتي من جدول labels في قاعدة البيانات (انظر src/data/labelSeeds.ts)
  const { t } = useLabels();
  const currentLabels = useLabelProxy('form.');

  const handleInputChange = useCallback(
    (field: keyof CheckData, value: string) => {
      if (field === 'date') onDateInput();
      setCheckData((current) => ({ ...current, [field]: value }));
    },
    [onDateInput, setCheckData]
  );

  const handlePositionChange = useCallback(
    (field: string, axis: 'x' | 'y', value: number) => {
      setPositions((current) => ({
        ...current,
        [field]: { ...current[field], [axis]: value },
      }));
    },
    [setPositions]
  );

  /** يحوّل مدخلات الأرقام إلى عدد صحيح، مع تجاهل القيم الفارغة */
  const parseNumericInput = (raw: string): number => {
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const renderPositionControls = (field: PositionField) => {
    if (!showPositionControls) return null;

    const theme = FIELD_THEME[field];
    const position = positions[field] ?? { x: 0, y: 0 };

    return (
      <div className={`bg-gradient-to-r ${theme.panel} p-2 md:p-3 rounded-xl space-y-2 border`}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className={`w-2.5 h-2.5 md:w-3 md:h-3 ${theme.dot}`} />
          <span className={`text-xs font-bold ${theme.heading} mobile-text-sm`}>
            {t('form.positionAdjust', { field: t(FIELD_LABEL_KEYS[field]) })}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['x', 'y'] as const).map((axis) => {
            const inputId = `${field}-${axis}`;
            return (
              <div key={axis}>
                <label
                  htmlFor={inputId}
                  className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 block mobile-text-sm"
                >
                  {axis === 'x' ? currentLabels.horizontal : currentLabels.vertical}
                </label>
                <input
                  id={inputId}
                  type="number"
                  step={1}
                  value={position[axis] ?? 0}
                  onChange={(e) => handlePositionChange(field, axis, parseNumericInput(e.target.value))}
                  className={`w-full px-2 py-1.5 text-xs border-2 ${theme.input} rounded-lg transition-all duration-200 mobile-input dark:bg-gray-700 dark:text-white`}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white/90 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-xl p-4 md:p-6 space-y-4 md:space-y-6 border border-white/20 dark:border-gray-700 hover-lift mobile-card">
      <div className="flex items-center justify-between">
        <h2 className="text-lg md:text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 md:p-2 rounded-xl">
            <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </div>
          {currentLabels.checkData}
        </h2>
        <button
          type="button"
          onClick={onTogglePositionControls}
          aria-expanded={showPositionControls}
          className={`flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 rounded-xl font-medium text-xs md:text-sm transition-all duration-300 transform hover:scale-105 mobile-button ${
            showPositionControls
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-yellow-500 text-white hover:bg-yellow-600'
          }`}
        >
          <Settings className="w-3 h-3 md:w-4 md:h-4" />
          <span className="hidden sm:inline">{currentLabels.positionControls}</span>
          <span className="sm:hidden" aria-hidden="true">⚙️</span>
        </button>
      </div>

      <div className={`grid sm:grid-cols-2 gap-3 md:gap-4 mobile-grid ${language === 'ar' ? 'text-right' : 'text-left'}`}>
        {/* تاريخ الشيك */}
        <div className="space-y-2 mobile-spacing">
          <label htmlFor="check-date" className="flex items-center gap-2 text-xs md:text-sm font-bold text-gray-700 dark:text-gray-300">
            <span className="bg-blue-100 dark:bg-blue-900/30 p-1 md:p-1.5 rounded-lg">
              <Calendar className="w-3 h-3 md:w-4 md:h-4 text-blue-600 dark:text-blue-400" />
            </span>
            {currentLabels.date}
          </label>
          <input
            id="check-date"
            type="date"
            value={checkData.date}
            onChange={(e) => handleInputChange('date', e.target.value)}
            className={`${INPUT_BASE} focus:ring-blue-500/20 focus:border-blue-500`}
          />
          {renderPositionControls('date')}
        </div>

        {/* مكان التحرير */}
        <div className="space-y-2 mobile-spacing">
          <label htmlFor="check-place" className="flex items-center gap-2 text-xs md:text-sm font-bold text-gray-700 dark:text-gray-300">
            <span className="bg-green-100 dark:bg-green-900/30 p-1 md:p-1.5 rounded-lg">
              <MapPin className="w-3 h-3 md:w-4 md:h-4 text-green-600 dark:text-green-400" />
            </span>
            {currentLabels.place}
          </label>
          <input
            id="check-place"
            type="text"
            value={checkData.place}
            onChange={(e) => handleInputChange('place', e.target.value)}
            placeholder={language === 'ar' ? 'مثال: الجزائر العاصمة' : 'Ex: Alger Centre'}
            className={`${INPUT_BASE} focus:ring-green-500/20 focus:border-green-500`}
          />
          {renderPositionControls('place')}
        </div>

        {/* اسم المستفيد */}
        <div className="space-y-2 mobile-spacing">
          <label htmlFor="check-beneficiary" className="flex items-center gap-2 text-xs md:text-sm font-bold text-gray-700 dark:text-gray-300">
            <span className="bg-purple-100 dark:bg-purple-900/30 p-1 md:p-1.5 rounded-lg">
              <User className="w-3 h-3 md:w-4 md:h-4 text-purple-600 dark:text-purple-400" />
            </span>
            {currentLabels.beneficiary}
          </label>
          <input
            id="check-beneficiary"
            type="text"
            value={checkData.beneficiary}
            onChange={(e) => handleInputChange('beneficiary', e.target.value)}
            placeholder={language === 'ar' ? 'مثال: أحمد بن محمد' : 'Ex: Ahmed Ben Mohamed'}
            className={`${INPUT_BASE} focus:ring-purple-500/20 focus:border-purple-500`}
          />
          {renderPositionControls('beneficiary')}
        </div>

        {/* المبلغ */}
        <div className="space-y-2 mobile-spacing">
          <label htmlFor="check-amount" className="flex items-center gap-2 text-xs md:text-sm font-bold text-gray-700 dark:text-gray-300">
            <span className="bg-yellow-100 dark:bg-yellow-900/30 p-1 md:p-1.5 rounded-lg">
              <DollarSign className="w-3 h-3 md:w-4 md:h-4 text-yellow-600 dark:text-yellow-400" />
            </span>
            {currentLabels.amount}
          </label>
          <input
            id="check-amount"
            type="number"
            inputMode="decimal"
            min={0}
            max={MAX_AMOUNT}
            step="0.01"
            value={checkData.amount}
            onChange={(e) => handleInputChange('amount', e.target.value)}
            placeholder={language === 'ar' ? 'مثال: 15000' : 'Ex: 15000'}
            className={`${INPUT_BASE} focus:ring-yellow-500/20 focus:border-yellow-500`}
          />
          {renderPositionControls('amount')}
        </div>
      </div>

      {/* التحكم في موضع المبلغ بالحروف */}
      {showPositionControls && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-3 md:p-4 rounded-xl border border-orange-100 dark:border-orange-800 mobile-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-orange-100 dark:bg-orange-900/30 p-1 md:p-1.5 rounded-lg">
              <Sparkles className="w-3 h-3 md:w-4 md:h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="text-xs md:text-sm font-bold text-orange-800 dark:text-orange-200 mobile-text-base">
              {currentLabels.amountInWords}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(['x', 'y'] as const).map((axis) => {
              const inputId = `amountWords-${axis}`;
              return (
                <div key={axis}>
                  <label
                    htmlFor={inputId}
                    className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 block mobile-text-sm"
                  >
                    {axis === 'x' ? currentLabels.horizontal : currentLabels.vertical}
                  </label>
                  <input
                    id={inputId}
                    type="number"
                    step={1}
                    value={positions.amountWords?.[axis] ?? 0}
                    onChange={(e) => handlePositionChange('amountWords', axis, parseNumericInput(e.target.value))}
                    className="w-full px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm border-2 border-orange-200 dark:border-orange-700 rounded-lg focus:border-orange-500 dark:focus:border-orange-400 transition-all duration-200 mobile-input dark:bg-gray-700 dark:text-white"
                  />
                </div>
              );
            })}
            <div className="col-span-2">
              <label
                htmlFor="amountWords-widthPercent"
                className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 block mobile-text-sm"
              >
                {currentLabels.amountWordsWidth}
              </label>
              <input
                id="amountWords-widthPercent"
                type="number"
                min={MIN_WIDTH_PERCENT}
                max={MAX_WIDTH_PERCENT}
                step={1}
                value={clampWidthPercent(positions.amountWords?.widthPercent)}
                onChange={(e) =>
                  setPositions((current) => ({
                    ...current,
                    amountWords: {
                      ...current.amountWords,
                      widthPercent: clampWidthPercent(parseNumericInput(e.target.value)),
                    },
                  }))
                }
                className="w-full px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm border-2 border-orange-200 dark:border-orange-700 rounded-lg focus:border-orange-500 dark:focus:border-orange-400 transition-all duration-200 mobile-input dark:bg-gray-700 dark:text-white"
                placeholder={language === 'ar' ? 'مثال: 50' : 'Ex: 50'}
                aria-describedby="amountWords-widthPercent-hint"
              />
              <p
                id="amountWords-widthPercent-hint"
                className="mt-1 text-[11px] text-orange-700 dark:text-orange-300"
              >
                {currentLabels.widthHint}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* حفظ القالب الحالي */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-3 md:p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 mobile-card">
        <h3 className="flex items-center gap-2 text-xs md:text-sm font-bold text-indigo-800 dark:text-indigo-200 mobile-text-base mb-3">
          <Bookmark className="w-3 h-3 md:w-4 md:h-4 text-indigo-600 dark:text-indigo-400" />
          {currentLabels.presets}
        </h3>

        <div className="flex flex-col sm:flex-row gap-2">
          <label htmlFor="preset-name" className="sr-only">
            {currentLabels.presetName}
          </label>
          <input
            id="preset-name"
            type="text"
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            placeholder={currentLabels.presetName}
            maxLength={60}
            className="flex-1 px-3 py-2 text-xs md:text-sm border-2 border-indigo-200 dark:border-indigo-700 rounded-lg focus:border-indigo-500 dark:focus:border-indigo-400 transition-all duration-200 bg-white/80 dark:bg-gray-700 dark:text-white"
          />
          <button
            type="button"
            disabled={isSavingPreset}
            onClick={async () => {
              setIsSavingPreset(true);
              try {
                await onSavePreset(presetName);
                setPresetName('');
              } finally {
                setIsSavingPreset(false);
              }
            }}
            className="flex items-center justify-center gap-1.5 px-3 md:px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs md:text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Save className="w-3 h-3 md:w-4 md:h-4" />
            {currentLabels.savePreset}
          </button>
        </div>

        {presets.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label
              htmlFor="preset-update"
              className="text-xs font-medium text-indigo-700 dark:text-indigo-300"
            >
              {currentLabels.updatePreset}
            </label>
            <select
              id="preset-update"
              defaultValue=""
              onChange={async (event) => {
                const selected = presets.find((preset) => preset.id === event.target.value);
                if (!selected) return;
                await onUpdatePreset(selected);
                event.target.value = '';
              }}
              className="px-2 py-1.5 text-xs border-2 border-indigo-200 dark:border-indigo-700 rounded-lg bg-white/80 dark:bg-gray-700 dark:text-white"
            >
              <option value="">{currentLabels.noPresetSelected}</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {showPositionControls && (
        <div className="bg-gradient-to-r from-blue-50 to-yellow-50 dark:from-blue-900/20 dark:to-yellow-900/20 p-3 md:p-4 rounded-xl border border-blue-100 dark:border-blue-800 mobile-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-blue-600 p-1 md:p-1.5 rounded-lg">
              <Sparkles className="w-3 h-3 md:w-4 md:h-4 text-white" />
            </div>
            <h3 className="text-xs md:text-sm font-bold text-blue-800 dark:text-blue-200 mobile-text-base">
              {currentLabels.positionTips}
            </h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 md:gap-3 text-xs mobile-text-sm">
            <div className="space-y-1">
              <p className="text-blue-700 dark:text-blue-300 font-medium">• {currentLabels.tip1}</p>
              <p className="text-blue-700 dark:text-blue-300 font-medium">• {currentLabels.tip2}</p>
            </div>
            <div className="space-y-1">
              <p className="text-yellow-700 dark:text-yellow-300 font-medium">• {currentLabels.tip3}</p>
              <p className="text-yellow-700 dark:text-yellow-300 font-medium">• {currentLabels.tip4}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckForm;
