import React from 'react';
import { Calendar, MapPin, User, DollarSign, Settings, Sparkles, Banknote, Type } from 'lucide-react';

interface CheckData {
  date: string;
  place: string;
  beneficiary: string;
  amount: string;
}

interface Position {
  x: number;
  y: number;
  width?: number;
  fontSize?: number; // إضافة خاصية حجم الخط
}

interface Bank {
  id: string;
  name: string;
  name_fr: string;
  checkImageUrl: string;
  initialPositions: {
    ar: Record<string, Position>;
    fr: Record<string, Position>;
  };
}

interface CheckFormProps {
  checkData: CheckData;
  setCheckData: (data: CheckData) => void;
  positions: Record<string, Position>;
  setPositions: (positions: Record<string, Position>) => void;
  showPositionControls: boolean;
  setShowPositionControls: (show: boolean) => void;
  banks: Bank[];
  selectedBank: Bank;
  setSelectedBank: (bank: Bank) => void;
  language: 'ar' | 'fr';
  t: any;
}

const CheckForm: React.FC<CheckFormProps> = ({
  checkData,
  setCheckData,
  positions,
  setPositions,
  showPositionControls,
  setShowPositionControls,
  banks,
  selectedBank,
  setSelectedBank,
  language,
  t
}) => {
  const handleDataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCheckData(prev => ({ ...prev, [name]: value }));
  };

  const handlePositionChange = (field: string, axis: 'x' | 'y' | 'width' | 'fontSize', value: number) => {
    setPositions(prevPositions => ({
      ...prevPositions,
      [field]: {
        ...(prevPositions[field] || {}),
        [axis]: value,
      },
    }));
  };

  // دالة لتعيين القيم الافتراضية لحجم الخط
  const getDefaultFontSize = (field: string): number => {
    switch (field) {
      case 'date':
      case 'place':
      case 'beneficiary':
        return 14;
      case 'amount':
        return 18;
      case 'amountWords':
        return 12;
      default:
        return 14;
    }
  };

  return (
    <div className=" bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-white/20 hover-lift mobile-card">
      <div className="bg-blue-600 px-4 md:px-6 py-3 md:py-4 no-print">
        <div className="flex items-center gap-2">
          <div className="bg-white/20 p-1 md:p-1.5 rounded-lg"><Banknote className="w-4 h-4 md:w-5 md:h-5 text-white" /></div>
          <h2 className="text-base md:text-lg font-bold text-white">{t.checkData}</h2>
        </div>
      </div>

      <div className="p-3 md:p-6">
        <div className="mb-4">
          <label htmlFor="bankSelect" className="block text-sm font-bold text-gray-700 mb-2">
            {t.selectBank}
          </label>
          <select
            id="bankSelect"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
            value={selectedBank.id}
            onChange={(e) => setSelectedBank(banks.find(bank => bank.id === e.target.value) || banks[0])}
          >
            {banks.map(bank => (
              <option key={bank.id} value={bank.id}>
                {language === 'ar' ? bank.name : bank.name_fr}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div>
            <label htmlFor="date" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" /> {t.checkDate}
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={checkData.date}
              onChange={handleDataChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
              dir="ltr"
            />
          </div>
          <div>
            <label htmlFor="place" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-500" /> {t.issuePlace}
            </label>
            <input
              type="text"
              id="place"
              name="place"
              value={checkData.place}
              onChange={handleDataChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
              placeholder={t.placePlaceholder}
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="beneficiary" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-500" /> {t.beneficiaryName}
            </label>
            <input
              type="text"
              id="beneficiary"
              name="beneficiary"
              value={checkData.beneficiary}
              onChange={handleDataChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
              placeholder={t.beneficiaryPlaceholder}
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="amount" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-500" /> {t.amountDZD}
            </label>
            <input
              type="number"
              id="amount"
              name="amount"
              value={checkData.amount}
              onChange={handleDataChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
              placeholder={t.amountPlaceholder}
              dir="ltr"
            />
          </div>
        </div>

        <div className="mt-6 border-t border-gray-200 pt-6">
          <button
            onClick={() => setShowPositionControls(!showPositionControls)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors font-medium text-sm md:text-base"
          >
            <Settings className="w-4 h-4" />
            <span>{t.positionControl}</span>
          </button>
        </div>
      </div>

      {showPositionControls && (
        <div className="border-t-2 border-gray-100 pt-4 mt-4 space-y-4">
          {Object.keys(positions).map(field => (
            <div key={field} className="bg-gradient-to-r from-blue-50 to-yellow-50 p-3 rounded-xl border border-blue-100 mobile-card">
              <h3 className="text-xs md:text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
                <Type className="w-4 h-4" />
                {t[`adjust${field.charAt(0).toUpperCase() + field.slice(1)}Position`] || `Adjust ${field} Position`}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">{t.horizontalPosition}</label>
                  <input
                    type="number"
                    value={positions[field]?.x || 0}
                    onChange={(e) => handlePositionChange(field, 'x', parseInt(e.target.value))}
                    className="w-full px-2 py-1.5 text-xs border-2 border-blue-200 rounded-lg focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">{t.verticalPosition}</label>
                  <input
                    type="number"
                    value={positions[field]?.y || 0}
                    onChange={(e) => handlePositionChange(field, 'y', parseInt(e.target.value))}
                    className="w-full px-2 py-1.5 text-xs border-2 border-blue-200 rounded-lg focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block flex items-center gap-1">
                    <Type className="w-3 h-3" />
                    {t.fontSize || 'حجم الخط'}
                  </label>
                  <input
                    type="number"
                    min="8"
                    max="30"
                    step="1"
                    value={positions[field]?.fontSize || getDefaultFontSize(field)}
                    onChange={(e) => handlePositionChange(field, 'fontSize', parseInt(e.target.value))}
                    className="w-full px-2 py-1.5 text-xs border-2 border-purple-200 rounded-lg focus:border-purple-500"
                  />
                </div>
                {field === 'amountWords' && (
                  <div className="md:col-span-3">
                    <label className="text-xs font-bold text-gray-600 mb-1 block">{t.widthPosition}</label>
                    <input
                      type="number"
                      value={positions[field]?.width || 0}
                      onChange={(e) => handlePositionChange(field, 'width', parseInt(e.target.value))}
                      className="w-full px-2 py-1.5 text-xs border-2 border-green-200 rounded-lg focus:border-green-500"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CheckForm;