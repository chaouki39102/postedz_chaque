// تحويل الأرقام إلى كلمات باللغة العربية مع دعم المبالغ الكبيرة جداً
export const numberToArabicWords = (num: number, currency: string = 'دينار جزائري', decimalCurrency: string = 'سنتيم'): string => {
  if (isNaN(num) || !isFinite(num)) return '';
  
  // التحقق من الحد الأقصى المدعوم
  if (Math.abs(num) >= 1e18) {
    throw new Error('الرقم كبير جداً. الحد الأقصى المدعوم هو 999 كوادريليون');
  }
  
  // فصل الجزء الصحيح والعشري مع التعامل مع القيم السالبة
  const parts = Math.abs(num).toFixed(2).split('.');
  const integerPart = parseInt(parts[0]);
  const decimalPart = parseInt(parts[1]);

  let result = '';

  // تحويل الجزء الصحيح
  if (integerPart === 0 && decimalPart === 0) {
    result = 'صفر ' + currency;
  } else if (integerPart > 0) {
    result = convertIntegerToArabic(integerPart) + ' ' + currency;
  }

  // تحويل الجزء العشري إذا كان أكبر من صفر
  if (decimalPart > 0) {
    if (result) result += ' و ';
    result += convertIntegerToArabic(decimalPart) + ' ' + decimalCurrency;
  }

  // إضافة إشارة السالب إذا كان العدد أصغر من صفر
  if (num < 0) {
    result = 'سالب ' + result;
  }

  return result;
};

// دالة مساعدة لتحويل الأعداد الصحيحة مع دعم المبالغ الكبيرة
const convertIntegerToArabic = (num: number): string => {
  if (num === 0) return '';

  const ones = [
    '', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة',
    'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر',
    'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'
  ];

  const tens = [
    '', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'
  ];

  const hundreds = [
    '', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'
  ];

  // وحدات القياس الكبيرة
  const scaleUnits = [
    { value: 1e15, singular: 'كوادريليون', dual: 'كوادريليونان', plural: 'كوادريليونات' },
    { value: 1e12, singular: 'تريليون', dual: 'تريليونان', plural: 'تريليونات' },
    { value: 1e9, singular: 'مليار', dual: 'ملياران', plural: 'مليارات' },
    { value: 1e6, singular: 'مليون', dual: 'مليونان', plural: 'ملايين' },
    { value: 1e3, singular: 'ألف', dual: 'ألفان', plural: 'آلاف' }
  ];

  const convertThreeDigits = (n: number): string => {
    let result = '';
    const hundredsDigit = Math.floor(n / 100);
    
    if (hundredsDigit > 0) {
      result += hundreds[hundredsDigit];
    }
    
    const remainder = n % 100;
    
    if (remainder > 0) {
      if (result) result += ' و ';
      
      if (remainder < 20) {
        result += ones[remainder];
      } else {
        const tensDigit = Math.floor(remainder / 10);
        const onesDigit = remainder % 10;
        
        if (onesDigit > 0) {
          result += ones[onesDigit] + ' و ' + tens[tensDigit];
        } else {
          result += tens[tensDigit];
        }
      }
    }
    
    return result;
  };

  const getScaleWord = (count: number, unit: typeof scaleUnits[0]): string => {
    if (count === 1) {
      return unit.singular;
    } else if (count === 2) {
      return unit.dual;
    } else if (count >= 3 && count <= 10) {
      return unit.plural;
    } else {
      return unit.singular;
    }
  };

  if (num < 1000) {
    return convertThreeDigits(num);
  }

  const parts: string[] = [];
  let remainingNum = num;

  // معالجة كل وحدة قياس من الأكبر إلى الأصغر
  for (const unit of scaleUnits) {
    if (remainingNum >= unit.value) {
      const count = Math.floor(remainingNum / unit.value);
      const countText = convertThreeDigits(count);
      const scaleWord = getScaleWord(count, unit);
      
      if (count === 1 && (unit.value === 1e3 || unit.value === 1e6)) {
        // حالات خاصة للألف والمليون
        parts.push(scaleWord);
      } else {
        parts.push(countText + ' ' + scaleWord);
      }
      
      remainingNum %= unit.value;
    }
  }

  // إضافة الجزء المتبقي (أقل من 1000)
  if (remainingNum > 0) {
    parts.push(convertThreeDigits(remainingNum));
  }

  return parts.join(' و ').replace(/\s+/g, ' ').trim();
};

// تحويل الأرقام إلى كلمات باللغة الفرنسية مع دعم المبالغ الكبيرة
export const numberToFrenchWords = (num: number, currency: string = 'Dinar Algérien', decimalCurrency: string = 'Centime'): string => {
  if (isNaN(num) || !isFinite(num)) return '';
  
  // التحقق من الحد الأقصى المدعوم
  if (Math.abs(num) >= 1e18) {
    throw new Error('Nombre trop grand. Maximum supporté: 999 quadrillions');
  }
  
  const parts = Math.abs(num).toFixed(2).split('.');
  const integerPart = parseInt(parts[0]);
  const decimalPart = parseInt(parts[1]);

  let result = '';

  // تحويل الجزء الصحيح
  if (integerPart === 0 && decimalPart === 0) {
    result = 'Zéro ' + currency;
  } else if (integerPart > 0) {
    result = convertIntegerToFrench(integerPart);
    
    // إضافة العملة مع الجمع المناسب
    if (integerPart > 1) {
      result += ' ' + currency + 's';
    } else {
      result += ' ' + currency;
    }
  }

  // تحويل الجزء العشري
  if (decimalPart > 0) {
    if (result) result += ' et ';
    const centimeText = decimalPart === 1 ? decimalCurrency : decimalCurrency + 's';
    result += convertLessThanOneHundred(decimalPart) + ' ' + centimeText;
  }

  if (num < 0) {
    result = 'moins ' + result;
  }

  return result;
};

// دالة مساعدة لتحويل الأعداد الصحيحة بالفرنسية مع دعم المبالغ الكبيرة
const convertIntegerToFrench = (num: number): string => {
  if (num === 0) return '';
  
  // وحدات القياس الكبيرة بالفرنسية
  const scaleUnits = [
    { value: 1e15, name: 'Billiard' }, // في النظام الفرنسي
    { value: 1e12, name: 'Billion' },
    { value: 1e9, name: 'Milliard' },
    { value: 1e6, name: 'Million' },
    { value: 1e3, name: 'Mille' }
  ];

  if (num < 1000) {
    return convertUpToThousand(num);
  }

  const parts: string[] = [];
  let remainingNum = num;

  // معالجة كل وحدة قياس من الأكبر إلى الأصغر
  for (const unit of scaleUnits) {
    if (remainingNum >= unit.value) {
      const count = Math.floor(remainingNum / unit.value);
      let part = '';
      
      if (unit.value === 1e3) {
        // حالة خاصة للألف
        if (count === 1) {
          part = 'Mille';
        } else {
          part = convertUpToThousand(count) + ' Mille';
        }
      } else {
        // باقي الوحدات
        const countText = convertUpToThousand(count);
        if (count === 1) {
          part = 'Un ' + unit.name;
        } else {
          part = countText + ' ' + unit.name + 's';
        }
      }
      
      parts.push(part);
      remainingNum %= unit.value;
    }
  }

  // إضافة الجزء المتبقي (أقل من 1000)
  if (remainingNum > 0) {
    parts.push(convertUpToThousand(remainingNum));
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
};

// دالة مساعدة لتحويل الأعداد حتى 999
const convertUpToThousand = (num: number): string => {
  if (num === 0) return '';
  if (num < 100) return convertLessThanOneHundred(num);
  
  const hundreds = Math.floor(num / 100);
  const remainder = num % 100;
  
  let result = '';
  
  // معالجة المئات
  if (hundreds > 0) {
    if (hundreds === 1) {
      result = 'Cent';
    } else {
      result = convertLessThanOneHundred(hundreds) + ' Cent';
    }
    
    // إضافة 's' لمئات بدون باقي
    if (remainder === 0 && hundreds > 1) {
      result += 's';
    }
  }
  
  if (remainder > 0) {
    if (result) result += ' ';
    result += convertLessThanOneHundred(remainder);
  }
  
  return result;
};

// دالة مساعدة للأعداد أقل من 100 (محسنة)
const convertLessThanOneHundred = (n: number): string => {
  const units = ['', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf'];
  const teens = ['Dix', 'Onze', 'Douze', 'Treize', 'Quatorze', 'Quinze', 'Seize', 'Dix-Sept', 'Dix-Huit', 'Dix-neuf'];
  const tens = ['', 'Dix', 'Vingt', 'Trente', 'Quarante', 'Cinquante', 'Soixante', 'Soixante', 'Quatre-Vingt', 'Quatre-Vingt'];

  if (n === 0) return '';
  if (n < 10) return units[n];
  if (n < 20) return teens[n - 10];
  
  const ten = Math.floor(n / 10);
  const unit = n % 10;
  
  // معالجة 70-79 و 90-99
  if (ten === 7) {
    if (unit === 0) return 'Soixante-Dix';
    if (unit === 1) return 'Soixante et Onze';
    return `Soixante-${teens[unit]}`;
  }
  
  if (ten === 9) {
    if (unit === 0) return 'Quatre-Vingt-Dix';
    if (unit === 1) return 'Quatre-Vingt-Onze';
    return `Quatre-Vingt-${teens[unit]}`;
  }
  
  // معالجة 80
  if (ten === 8 && unit === 0) return 'Quatre-Vingts';
  
  if (unit === 0) return tens[ten];
  
  // إضافة "et" مع un للعشرات 20, 30, 40, 50, 60
  if (unit === 1 && ten >= 2 && ten <= 6) {
    return `${tens[ten]} et Un`;
  }
  
  if (ten === 8) return `Quatre-vingt-${units[unit]}`;
  
  return `${tens[ten]}-${units[unit]}`;
};

// دوال مساعدة إضافية
export const formatNumber = (num: number): string => {
  return num.toLocaleString('ar-DZ');
};

export const validateNumber = (num: number): boolean => {
  return !isNaN(num) && isFinite(num) && Math.abs(num) < 1e18;
};

