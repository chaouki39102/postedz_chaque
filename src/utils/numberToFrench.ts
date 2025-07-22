const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
const teens = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingt", "quatre-vingt-dix"];

function convertLessThanOneThousand(n: number): string {
  if (n === 0) return '';
  
  let result = '';
  const hundred = Math.floor(n / 100);
  const remainder = n % 100;
  
  if (hundred > 0) {
    if (hundred === 1) {
      result += 'cent';
    } else {
      result += units[hundred] + '-cent';
    }
    
    // إضافة "s" فقط إذا كان المئات أكثر من 1 وليس هناك باقي
    if (hundred > 1 && remainder === 0) {
      result += 's';
    }
  }
  
  if (remainder > 0) {
    if (hundred > 0) result += ' ';
    
    if (remainder < 10) {
      result += units[remainder];
    } else if (remainder < 20) {
      result += teens[remainder - 10];
    } else {
      const ten = Math.floor(remainder / 10);
      const unit = remainder % 10;
      
      if (ten === 7) {
        // soixante-dix, soixante et onze, soixante-douze, etc.
        result += "soixante";
        if (unit === 0) {
          result += "-dix";
        } else if (unit === 1) {
          result += " et onze";
        } else {
          result += "-" + teens[unit];
        }
      } else if (ten === 9) {
        // quatre-vingt-dix, quatre-vingt-onze, etc.
        result += "quatre-vingt";
        if (unit === 0) {
          result += "-dix";
        } else if (unit === 1) {
          result += " et onze";
        } else {
          result += "-" + teens[unit];
        }
      } else {
        result += tens[ten];
        if (unit > 0) {
          if (unit === 1 && (ten === 2 || ten === 3 || ten === 4 || ten === 5 || ten === 6)) {
            result += " et " + units[unit];
          } else {
            result += "-" + units[unit];
          }
        } else if (ten === 8) {
          result += "s"; // quatre-vingts
        }
      }
    }
  }
  
  return result;
}

export function numberToFrenchWords(num: number | string): string {
  const number = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(number) || number < 0) return '';

  if (number === 0) return 'zéro Dinar Algérien';
  
  const integerPart = Math.floor(number);
  const decimalPart = Math.round((number - integerPart) * 100);
  
  let words = '';
  
  // معالجة الجزء الصحيح
  if (integerPart >= 1000000) {
    const millions = Math.floor(integerPart / 1000000);
    const millionWords = convertLessThanOneThousand(millions);
    words += millionWords + ' million' + (millions > 1 ? 's' : '');
    
    const remainder = integerPart % 1000000;
    if (remainder > 0) words += ' ';
  }
  
  if (integerPart >= 1000) {
    const thousands = Math.floor((integerPart % 1000000) / 1000);
    if (thousands > 0) {
      if (thousands === 1) {
        words += 'mille';
      } else {
        words += convertLessThanOneThousand(thousands) + ' mille';
      }
      
      const remainder = integerPart % 1000;
      if (remainder > 0) words += ' ';
    }
  }
  
  const lastThousand = integerPart % 1000;
  if (lastThousand > 0) {
    words += convertLessThanOneThousand(lastThousand);
  }
  
  // إضافة العملة مرة واحدة فقط للجزء الصحيح
  words += ' Dinar Algérien';
  
  // معالجة الجزء العشري (centimes) - تصحيح الخطأ هنا
  if (decimalPart > 0) {
    words += ' et ' + convertLessThanOneThousand(decimalPart);
    words += ' centime' + (decimalPart > 1 ? 's' : '');
  }
  
  return words.trim();
}