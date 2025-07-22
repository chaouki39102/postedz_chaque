import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Printer, Eye, Lock, Unlock } from 'lucide-react';
import { numberToArabicWords } from '../utils/numberToArabic';
import { numberToFrenchWords } from '../utils/numberToFrench';

interface TranslationKeys {
  algeriaPostCheck: string;
  electronicCheckFilling: string;
  autoNumberConversion: string;
  checkData: string;
  positionControl: string;
  positions: string;
  checkDate: string;
  issuePlace: string;
  beneficiaryName: string;
  amountDZD: string;
  adjustDatePosition: string;
  adjustPlacePosition: string;
  adjustBeneficiaryPosition: string;
  adjustAmountPosition: string;
  adjustAmountWordsPosition: string;
  horizontalPosition: string;
  verticalPosition: string;
  widthPosition: string;
  fontSize: string;
  checkPreview: string;
  print: string;
  lock: string;
  unlock: string;
  resetPositions: string;
  usageGuide: string;
  step1Title: string;
  step1Desc: string;
  step2Title: string;
  step2Desc: string;
  step3Title: string;
  step3Desc: string;
  step4Title: string;
  step4Desc: string;
  step5Title: string;
  step5Desc: string;
  algerianDinar: string;
  amountInWords: string;
  selectBank: string;
}

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
  fontSize?: number;
}

interface CheckPreviewProps {
  checkData: CheckData;
  positions: Record<string, Position>;
  setPositions: (positions: Record<string, Position>) => void;
  checkImageUrl: string;
  language: 'ar' | 'fr';
  t: TranslationKeys;
}

const CheckPreview: React.FC<CheckPreviewProps> = ({ checkData, positions, setPositions, checkImageUrl, language, t }) => {
  const [draggedElement, setDraggedElement] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialPosition, setInitialPosition] = useState({ x: 0, y: 0 });
  const [isLocked, setIsLocked] = useState(false);
  const checkRef = useRef<HTMLDivElement>(null);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString();
    return `${day}/${month}/${year}`;
  };

  const getAmountInWords = useCallback(() => {
    if (!checkData.amount) return '';
    const [integerPart, decimalPart] = checkData.amount.split('.');
    let words = '';

    if (language === 'ar') {
      words = numberToArabicWords(parseInt(integerPart || '0'));
      if (decimalPart && parseInt(decimalPart) > 0) {
        words += ` و${numberToArabicWords(parseInt(decimalPart))} سنتيم`;
      }
    } else { // French
      words = numberToFrenchWords(parseInt(integerPart || '0'));
      if (decimalPart && parseInt(decimalPart) > 0) {
        words += ` et ${numberToFrenchWords(parseInt(decimalPart))} centimes`;
      }
    }
    return words;
  }, [checkData.amount, language]);

  const handleMouseDown = useCallback((e: React.MouseEvent, field: string) => {
    if (isLocked) return;
    setDraggedElement(field);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPosition({ x: positions[field]?.x || 0, y: positions[field]?.y || 0 });
  }, [positions, isLocked]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !draggedElement || !checkRef.current) return;

    const checkRect = checkRef.current.getBoundingClientRect();
    const deltaX_percent = ((e.clientX - dragStart.x) / checkRect.width) * 100;
    const deltaY_percent = ((e.clientY - dragStart.y) / checkRect.height) * 100;

    const newX = initialPosition.x + deltaX_percent;
    const newY = initialPosition.y + deltaY_percent;

    setPositions(prevPositions => {
      const currentFieldPosition = prevPositions[draggedElement] || {};
      return {
        ...prevPositions,
        [draggedElement]: {
          ...currentFieldPosition,
          x: newX,
          y: newY,
        },
      };
    });
  }, [isDragging, draggedElement, dragStart, initialPosition, setPositions]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedElement(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // دالة لتحديد حجم الخط الافتراضي لكل حقل
  const getDefaultFontSize = useCallback((field: string): number => {
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
  }, []);

  const getFieldStyle = useCallback((field: string): React.CSSProperties => {
    const fontSize = positions[field]?.fontSize || getDefaultFontSize(field);
    
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${positions[field]?.x || 0}%`,
      top: `${positions[field]?.y || 0}%`,
      cursor: isLocked ? 'default' : 'grab',
      whiteSpace: 'nowrap',
      wordBreak: 'keep-all',
      fontSize: `${fontSize}px`,
    };

    if (field === 'amountWords') {
      return {
        ...baseStyle,
        maxWidth: positions.amountWords?.width ? `${positions.amountWords.width}px` : 'none',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
      };
    }
    return baseStyle;
  }, [positions, isLocked, getDefaultFontSize]);

  // دالة لتحديد لون وسمك النص حسب نوع الحقل
  const getFieldTextStyle = useCallback((field: string): string => {
    switch (field) {
      case 'amount':
        return 'text-red-700 font-bold';
      case 'amountWords':
        return 'text-black-700 font-bold';
      default:
        return 'text-blue-800 font-bold';
    }
  }, []);

  return (
    <div className="form-section bg-white rounded-2xl shadow-xl overflow-hidden relative border border-gray-200 mobile-card">
      <div className="px-4 md:px-6 py-3 md:py-4 bg-gray-50 flex items-center justify-between no-print">
        <h2 className="text-sm md:text-lg font-bold text-gray-800 flex items-center gap-2">
          <Eye className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
          {t.checkPreview}
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLocked(!isLocked)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition-colors ${
              isLocked ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-yellow-500 text-white hover:bg-yellow-600'
            }`}
          >
            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            <span>{isLocked ? t.lock : t.unlock}</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>{t.print}</span>
          </button>
        </div>
      </div>

      <div className="relative w-full overflow-hidden printable-area" ref={checkRef} style={{ paddingBottom: '56.25%' }}>
        <img src={checkImageUrl} alt="Check Preview" className="absolute top-0 left-0 w-full h-full object-contain" />

        {/* Draggable fields with font size support */}
        <div
          className="check-field absolute"
          style={getFieldStyle('date')}
          onMouseDown={(e) => handleMouseDown(e, 'date')}
        >
          <p className={getFieldTextStyle('date')} dir={language === 'fr' ? 'ltr' : 'rtl'}>
            {checkData.date ? formatDate(checkData.date) : (language === 'ar' ? 'DD/MM/YYYY' : 'JJ/MM/AAAA')}
          </p>
        </div>

        <div
          className="check-field absolute"
          style={getFieldStyle('place')}
          onMouseDown={(e) => handleMouseDown(e, 'place')}
        >
          <p className={getFieldTextStyle('place')} dir={language === 'fr' ? 'ltr' : 'rtl'}>
            {checkData.place || (language === 'ar' ? 'مكان التحرير...' : 'Lieu d\'émission...')}
          </p>
        </div>

        <div
          className="check-field absolute"
          style={getFieldStyle('beneficiary')}
          onMouseDown={(e) => handleMouseDown(e, 'beneficiary')}
        >
          <p className={getFieldTextStyle('beneficiary')} dir={language === 'fr' ? 'ltr' : 'rtl'}>
            {checkData.beneficiary || (language === 'ar' ? 'اسم المستفيد...' : 'Nom du bénéficiaire...')}
          </p>
        </div>

        <div
          className="check-field absolute"
          style={getFieldStyle('amount')}
          onMouseDown={(e) => handleMouseDown(e, 'amount')}
        >
          <p className={getFieldTextStyle('amount')} dir="ltr">
            {checkData.amount ? `${checkData.amount} ${language === 'ar' ?'' : ''}` : (language === 'ar' ? '0.00' : '0.00')}
          </p>
        </div>

        <div
          className="check-field absolute"
          style={getFieldStyle('amountWords')}
          onMouseDown={(e) => handleMouseDown(e, 'amountWords')}
        >
          <p className={getFieldTextStyle('amountWords')} dir={language === 'fr' ? 'ltr' : 'rtl'}>
            {checkData.amount ? getAmountInWords(): (language === 'ar' ? 'أدخل المبلغ...' : 'Entrez le montant...')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CheckPreview;