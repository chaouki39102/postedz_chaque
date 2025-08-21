import React, { useState } from 'react';
import { Calendar, MapPin, User, DollarSign, Settings, Sparkles } from 'lucide-react';
import { CheckData, Position, Language, Bank } from '../types';

interface CheckFormProps {
  checkData: CheckData;
  setCheckData: (data: CheckData) => void;
  positions: Record<string, Position>;
  setPositions: (positions: Record<string, Position>) => void;
  language: Language;
  bank: Bank;
}

const CheckForm: React.FC<CheckFormProps> = ({
  checkData,
  setCheckData,
  positions,
  setPositions,
  language,
  bank
}) => {
  const [showPositionControls, setShowPositionControls] = useState(false);

  const labels = {
    ar: {
      checkData: 'بيانات الشيك',
      date: 'تاريخ الشيك',
      place: 'مكان التحرير',
      beneficiary: 'اسم المستفيد',
      amount: 'المبلغ (بالدينار الجزائري)',
      positionControls: 'التحكم في المواضع',
      positionAdjustment: (field: string) => `ضبط موضع ${field}`,
      horizontal: 'الموضع الأفقي',
      vertical: 'الموضع العمودي',
      amountInWords: 'ضبط موضع المبلغ بالحروف',
      amountWordsWidth: 'عرض المبلغ بالحروف (بكسل)',
      positionTips: 'نصائح التحكم في المواضع',
      tip1: 'استخدم الأرقام الموجبة للتحرك يميناً وأسفل',
      tip2: 'استخدم الأرقام السالبة للتحرك يساراً وأعلى',
      tip3: 'اسحب النصوص بالفأرة لتحديد مواضعها',
      tip4: 'شاهد التغييرات مباشرة في معاينة الشيك'
    },
    fr: {
      checkData: 'Données du chèque',
      date: 'Date du chèque',
      place: 'Lieu d\'édition',
      beneficiary: 'Bénéficiaire',
      amount: 'Montant (en Dinar Algérien)',
      positionControls: 'Contrôle des positions',
      positionAdjustment: (field: string) => `Ajuster la position ${field}`,
      horizontal: 'Position horizontale',
      vertical: 'Position verticale',
      amountInWords: 'Ajuster la position du montant en lettres',
      amountWordsWidth: 'Largeur du montant en lettres (pixels)',
      positionTips: 'Conseils de positionnement',
      tip1: 'Utilisez des nombres positifs pour déplacer à droite et vers le bas',
      tip2: 'Utilisez des nombres négatifs pour déplacer à gauche et vers le haut',
      tip3: 'Faites glisser les textes avec la souris pour les positionner',
      tip4: 'Voir les changements directement dans l\'aperçu du chèque'
    }
  };

  const currentLabels = labels[language];

  const handleInputChange = (field: keyof CheckData, value: string) => {
    setCheckData({
      ...checkData,
      [field]: value
    });
  };

  const handlePositionChange = (field: string, axis: 'x' | 'y' | 'width', value: number) => {
    setPositions({
      ...positions,
      [field]: {
        ...positions[field],
        [axis]: value
      }
    });
  };

  const renderPositionControls = (field: string) => {
    if (!showPositionControls) return null;

    return (
      <div className={`bg-gradient-to-r ${
        field === 'date' ? 'from-blue-50 to-yellow-50 border-blue-100 dark:from-blue-900/20 dark:to-yellow-900/20 dark:border-blue-800' :
        field === 'place' ? 'from-green-50 to-emerald-50 border-green-100 dark:from-green-900/20 dark:to-emerald-900/20 dark:border-green-800' :
        field === 'beneficiary' ? 'from-purple-50 to-pink-50 border-purple-100 dark:from-purple-900/20 dark:to-pink-900/20 dark:border-purple-800' :
        'from-yellow-50 to-orange-50 border-yellow-100 dark:from-yellow-900/20 dark:to-orange-900/20 dark:border-yellow-800'
      } p-2 md:p-3 rounded-xl space-y-2 border`}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-2.5 h-2.5 md:w-3 md:h-3 ${
            field === 'date' ? 'text-blue-600 dark:text-blue-400' :
            field === 'place' ? 'text-green-600 dark:text-green-400' :
            field === 'beneficiary' ? 'text-purple-600 dark:text-purple-400' :
            'text-yellow-600 dark:text-yellow-400'
          }" />
          <span className="text-xs font-bold ${
            field === 'date' ? 'text-blue-800 dark:text-blue-200' :
            field === 'place' ? 'text-green-800 dark:text-green-200' :
            field === 'beneficiary' ? 'text-purple-800 dark:text-purple-200' :
            'text-yellow-800 dark:text-yellow-200'
          } mobile-text-sm">
            {currentLabels.positionAdjustment(field)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 block mobile-text-sm">
              {currentLabels.horizontal}
            </label>
            <input
              type="number"
              value={positions[field]?.x || 0}
              onChange={(e) => handlePositionChange(field, 'x', parseInt(e.target.value) || 0)}
              className="w-full px-2 py-1.5 text-xs border-2 ${
                field === 'date' ? 'border-blue-200 focus:border-blue-500 dark:border-blue-700 dark:focus:border-blue-400' :
                field === 'place' ? 'border-green-200 focus:border-green-500 dark:border-green-700 dark:focus:border-green-400' :
                field === 'beneficiary' ? 'border-purple-200 focus:border-purple-500 dark:border-purple-700 dark:focus:border-purple-400' :
                'border-yellow-200 focus:border-yellow-500 dark:border-yellow-700 dark:focus:border-yellow-400'
              } rounded-lg focus:border-blue-500 transition-all duration-200 mobile-input dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 block mobile-text-sm">
              {currentLabels.vertical}
            </label>
            <input
              type="number"
              value={positions[field]?.y || 0}
              onChange={(e) => handlePositionChange(field, 'y', parseInt(e.target.value) || 0)}
              className="w-full px-2 py-1.5 text-xs border-2 ${
                field === 'date' ? 'border-blue-200 focus:border-blue-500 dark:border-blue-700 dark:focus:border-blue-400' :
                field === 'place' ? 'border-green-200 focus:border-green-500 dark:border-green-700 dark:focus:border-green-400' :
                field === 'beneficiary' ? 'border-purple-200 focus:border-purple-500 dark:border-purple-700 dark:focus:border-purple-400' :
                'border-yellow-200 focus:border-yellow-500 dark:border-yellow-700 dark:focus:border-yellow-400'
              } rounded-lg focus:border-blue-500 transition-all duration-200 mobile-input dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-white/90 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-xl p-4 md:p-6 space-y-4 md:space-y-6 border border-white/20 dark:border-gray-700 hover-lift mobile-card`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg md:text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 md:p-2 rounded-xl">
            <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </div>
          {currentLabels.checkData}
        </h2>
        <button
          onClick={() => setShowPositionControls(!showPositionControls)}
          className={`flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 rounded-xl font-medium text-xs md:text-sm transition-all duration-300 transform hover:scale-105 mobile-button ${
            showPositionControls
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-yellow-500 text-white hover:bg-yellow-600'
          }`}
        >
          <Settings className="w-3 h-3 md:w-4 md:h-4" />
          <span className="hidden sm:inline">{currentLabels.positionControls}</span>
          <span className="sm:hidden">⚙️</span>
        </button>
      </div>

      <div className={`grid sm:grid-cols-2 gap-3 md:gap-4 mobile-grid ${language === 'ar' ? 'text-right' : 'text-left'}`}>
        {/* تاريخ الشيك */}
        <div className="space-y-2 mobile-spacing">
          <label className="flex items-center gap-2 text-xs md:text-sm font-bold text-gray-700 dark:text-gray-300">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-1 md:p-1.5 rounded-lg">
              <Calendar className="w-3 h-3 md:w-4 md:h-4 text-blue-600 dark:text-blue-400" />
            </div>
            {currentLabels.date}
          </label>
          <input
            type="date"
            value={checkData.date}
            onChange={(e) => handleInputChange('date', e.target.value)}
            className="w-full px-3 md:px-4 py-2.5 md:py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 text-sm font-medium bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm mobile-input dark:text-white"
          />
          {renderPositionControls('date')}
        </div>

        {/* مكان التحرير */}
        <div className="space-y-2 mobile-spacing">
          <label className="flex items-center gap-2 text-xs md:text-sm font-bold text-gray-700 dark:text-gray-300">
            <div className="bg-green-100 dark:bg-green-900/30 p-1 md:p-1.5 rounded-lg">
              <MapPin className="w-3 h-3 md:w-4 md:h-4 text-green-600 dark:text-green-400" />
            </div>
            {currentLabels.place}
          </label>
          <input
            type="text"
            value={checkData.place}
            onChange={(e) => handleInputChange('place', e.target.value)}
            placeholder={language === 'ar' ? "مثال: الجزائر العاصمة" : "Ex: Alger Centre"}
            className="w-full px-3 md:px-4 py-2.5 md:py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300 text-sm font-medium bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm mobile-input dark:text-white"
          />
          {renderPositionControls('place')}
        </div>

        {/* اسم المستفيد */}
        <div className="space-y-2 mobile-spacing">
          <label className="flex items-center gap-2 text-xs md:text-sm font-bold text-gray-700 dark:text-gray-300">
            <div className="bg-purple-100 dark:bg-purple-900/30 p-1 md:p-1.5 rounded-lg">
              <User className="w-3 h-3 md:w-4 md:h-4 text-purple-600 dark:text-purple-400" />
            </div>
            {currentLabels.beneficiary}
          </label>
          <input
            type="text"
            value={checkData.beneficiary}
            onChange={(e) => handleInputChange('beneficiary', e.target.value)}
            placeholder={language === 'ar' ? "مثال: أحمد بن محمد" : "Ex: Ahmed Ben Mohamed"}
            className="w-full px-3 md:px-4 py-2.5 md:py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-300 text-sm font-medium bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm mobile-input dark:text-white"
          />
          {renderPositionControls('beneficiary')}
        </div>

        {/* المبلغ */}
        <div className="space-y-2 mobile-spacing">
          <label className="flex items-center gap-2 text-xs md:text-sm font-bold text-gray-700 dark:text-gray-300">
            <div className="bg-yellow-100 dark:bg-yellow-900/30 p-1 md:p-1.5 rounded-lg">
              <DollarSign className="w-3 h-3 md:w-4 md:h-4 text-yellow-600 dark:text-yellow-400" />
            </div>
            {currentLabels.amount}
          </label>
          <input
            type="number"
            value={checkData.amount}
            onChange={(e) => handleInputChange('amount', e.target.value)}
            placeholder={language === 'ar' ? "مثال: 15000" : "Ex: 15000"}
            className="w-full px-3 md:px-4 py-2.5 md:py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 transition-all duration-300 text-sm font-medium bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm mobile-input dark:text-white"
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
            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 block mobile-text-sm">
                {currentLabels.horizontal}
              </label>
              <input
                type="number"
                value={positions.amountWords?.x || 0}
                onChange={(e) => handlePositionChange('amountWords', 'x', parseInt(e.target.value) || 0)}
                className="w-full px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm border-2 border-orange-200 dark:border-orange-700 rounded-lg focus:border-orange-500 dark:focus:border-orange-400 transition-all duration-200 mobile-input dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 block mobile-text-sm">
                {currentLabels.vertical}
              </label>
              <input
                type="number"
                value={positions.amountWords?.y || 0}
                onChange={(e) => handlePositionChange('amountWords', 'y', parseInt(e.target.value) || 0)}
                className="w-full px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm border-2 border-orange-200 dark:border-orange-700 rounded-lg focus:border-orange-500 dark:focus:border-orange-400 transition-all duration-200 mobile-input dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 block mobile-text-sm">
                {currentLabels.amountWordsWidth}
              </label>
              <input
                type="number"
                value={positions.amountWords?.width || 0}
                onChange={(e) => handlePositionChange('amountWords', 'width', parseInt(e.target.value) || 0)}
                className="w-full px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm border-2 border-orange-200 dark:border-orange-700 rounded-lg focus:border-orange-500 dark:focus:border-orange-400 transition-all duration-200 mobile-input dark:bg-gray-700 dark:text-white"
                placeholder={language === 'ar' ? "مثال: 450" : "Ex: 450"}
              />
            </div>
          </div>
        </div>
      )}

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