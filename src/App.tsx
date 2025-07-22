import React, { useState, useEffect, useCallback } from 'react';
import CheckForm from './components/CheckForm';
import CheckPreview from './components/CheckPreview';
import { Sparkles, Languages } from 'lucide-react';

import ar from './locales/ar.json';
import fr from './locales/fr.json';

const translations = { ar, fr };

interface CheckData {
  date: string;
  place: string;
  beneficiary: string;
  amount: string;
}

interface Position {
  x: number;
  y: number;
  width?: number; // أضف هذه الخاصية
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

// تعريف البنوك مع المواقع الافتراضية
const initialBanks: Bank[] = [
  {
    id: 'poste_dz',
    name: 'بريد الجزائر',
    name_fr: 'Algérie Poste',
    checkImageUrl: '/banks/alg-cndp.jpg',
    initialPositions: {
      ar: {
        date: { x: 500, y: 100 },
        place: { x: 100, y: 100 },
        beneficiary: { x: 150, y: 200 },
        amount: { x: 600, y: 150 },
        amountWords: { x: 150, y: 250, width: 400 },
      },
      fr: {
        date: { x: 500, y: 100 },
        place: { x: 100, y: 100 },
        beneficiary: { x: 150, y: 200 },
        amount: { x: 600, y: 150 },
        amountWords: { x: 150, y: 250, width: 400 },
      }
    },
  },
  {
    id: 'bna_dz',
    name: 'البنك الوطني الجزائري',
    name_fr: 'Banque Nationale d\'Algérie',
    checkImageUrl: '/banks/alg-bna.jpg',
    initialPositions: {
      ar: {
        date: { x: 480, y: 110 },
        place: { x: 120, y: 110 },
        beneficiary: { x: 170, y: 210 },
        amount: { x: 620, y: 160 },
        amountWords: { x: 170, y: 260, width: 400 },
      },
      fr: {
        date: { x: 480, y: 110 },
        place: { x: 120, y: 110 },
        beneficiary: { x: 170, y: 210 },
        amount: { x: 620, y: 160 },
        amountWords: { x: 170, y: 260, width: 400 },
      }
    },
  },
  // *** البنوك الجديدة التي طلبتها ***
  {
    id: 'abc_dz_2',
    name: 'بنك ABC - نموذج 2',
    name_fr: 'ABC Bank - Modèle 2',
    checkImageUrl: '/banks/alg-abc2.jpg',
    initialPositions: {
      ar: { date: { x: 520, y: 90 }, place: { x: 110, y: 90 }, beneficiary: { x: 160, y: 190 }, amount: { x: 610, y: 140 }, amountWords: { x: 160, y: 240, width: 400 } },
      fr: { date: { x: 520, y: 90 }, place: { x: 110, y: 90 }, beneficiary: { x: 160, y: 190 }, amount: { x: 610, y: 140 }, amountWords: { x: 160, y: 240, width: 400 } },
    },
  },
  {
    id: 'abc_dz_24',
    name: 'بنك ABC - نموذج 24',
    name_fr: 'ABC Bank - Modèle 24',
    checkImageUrl: '/banks/alg-abc24.jpg',
    initialPositions: {
      ar: { date: { x: 510, y: 95 }, place: { x: 105, y: 95 }, beneficiary: { x: 155, y: 195 }, amount: { x: 605, y: 145 }, amountWords: { x: 155, y: 245, width: 400 } },
      fr: { date: { x: 510, y: 95 }, place: { x: 105, y: 95 }, beneficiary: { x: 155, y: 195 }, amount: { x: 605, y: 145 }, amountWords: { x: 155, y: 245, width: 400 } },
    },
  },
  {
    id: 'bank_algeria',
    name: 'بنك الجزائر',
    name_fr: 'Banque d\'Algérie',
    checkImageUrl: '/banks/alg-alg.jpg',
    initialPositions: {
      ar: { date: { x: 505, y: 105 }, place: { x: 115, y: 105 }, beneficiary: { x: 165, y: 205 }, amount: { x: 615, y: 155 }, amountWords: { x: 165, y: 255, width: 400 } },
      fr: { date: { x: 505, y: 105 }, place: { x: 115, y: 105 }, beneficiary: { x: 165, y: 205 }, amount: { x: 615, y: 155 }, amountWords: { x: 165, y: 255, width: 400 } },
    },
  },
  {
    id: 'bdl_dz',
    name: 'بنك التنمية المحلية',
    name_fr: 'Banque de Développement Local',
    checkImageUrl: '/banks/alg-bdl.jpg',
    initialPositions: {
      ar: { date: { x: 490, y: 100 }, place: { x: 100, y: 100 }, beneficiary: { x: 150, y: 200 }, amount: { x: 590, y: 150 }, amountWords: { x: 150, y: 250, width: 400 } },
      fr: { date: { x: 490, y: 100 }, place: { x: 100, y: 100 }, beneficiary: { x: 150, y: 200 }, amount: { x: 590, y: 150 }, amountWords: { x: 150, y: 250, width: 400 } },
    },
  },
  {
    id: 'bdl_dz_2',
    name: 'بنك التنمية المحلية - نموذج 2',
    name_fr: 'Banque de Développement Local - Modèle 2',
    checkImageUrl: '/banks/alg-bdl2.jpg',
    initialPositions: {
      ar: { date: { x: 495, y: 105 }, place: { x: 105, y: 105 }, beneficiary: { x: 155, y: 205 }, amount: { x: 595, y: 155 }, amountWords: { x: 155, y: 255, width: 400 } },
      fr: { date: { x: 495, y: 105 }, place: { x: 105, y: 105 }, beneficiary: { x: 155, y: 205 }, amount: { x: 595, y: 155 }, amountWords: { x: 155, y: 255, width: 400 } },
    },
  },
  {
    id: 'bea_dz',
    name: 'البنك الخارجي الجزائري',
    name_fr: 'Banque Extérieure d\'Algérie',
    checkImageUrl: '/banks/alg-bea.jpg',
    initialPositions: {
      ar: { date: { x: 510, y: 110 }, place: { x: 120, y: 110 }, beneficiary: { x: 170, y: 210 }, amount: { x: 620, y: 160 }, amountWords: { x: 170, y: 260, width: 400 } },
      fr: { date: { x: 510, y: 110 }, place: { x: 120, y: 110 }, beneficiary: { x: 170, y: 210 }, amount: { x: 620, y: 160 }, amountWords: { x: 170, y: 260, width: 400 } },
    },
  },
  {
    id: 'bna_dz_2',
    name: 'البنك الوطني الجزائري - نموذج 2',
    name_fr: 'Banque Nationale d\'Algérie - Modèle 2',
    checkImageUrl: '/banks/alg-bna2.jpg',
    initialPositions: {
      ar: { date: { x: 485, y: 115 }, place: { x: 125, y: 115 }, beneficiary: { x: 175, y: 215 }, amount: { x: 625, y: 165 }, amountWords: { x: 175, y: 265, width: 400 } },
      fr: { date: { x: 485, y: 115 }, place: { x: 125, y: 115 }, beneficiary: { x: 175, y: 215 }, amount: { x: 625, y: 165 }, amountWords: { x: 175, y: 265, width: 400 } },
    },
  },
  {
    id: 'bnp_dz',
    name: 'BNP باريبا الجزائر',
    name_fr: 'BNP Paribas El Djazaïr',
    checkImageUrl: '/banks/alg-bnp.jpg',
    initialPositions: {
      ar: { date: { x: 500, y: 90 }, place: { x: 110, y: 90 }, beneficiary: { x: 160, y: 190 }, amount: { x: 600, y: 140 }, amountWords: { x: 160, y: 240, width: 400 } },
      fr: { date: { x: 500, y: 90 }, place: { x: 110, y: 90 }, beneficiary: { x: 160, y: 190 }, amount: { x: 600, y: 140 }, amountWords: { x: 160, y: 240, width: 400 } },
    },
  },
  {
    id: 'albaraka_dz',
    name: 'بنك البركة الجزائر',
    name_fr: 'Al Baraka Bank Algérie',
    checkImageUrl: '/banks/alg-brka3.jpg',
    initialPositions: {
      ar: { date: { x: 515, y: 100 }, place: { x: 105, y: 100 }, beneficiary: { x: 155, y: 200 }, amount: { x: 605, y: 150 }, amountWords: { x: 155, y: 250, width: 400 } },
      fr: { date: { x: 515, y: 100 }, place: { x: 105, y: 100 }, beneficiary: { x: 155, y: 200 }, amount: { x: 605, y: 150 }, amountWords: { x: 155, y: 250, width: 400 } },
    },
  },
  {
    id: 'cnep_dz',
    name: 'القرض الشعبي الجزائري (CNEP)',
    name_fr: 'Crédit Populaire d\'Algérie (CNEP)',
    checkImageUrl: '/banks/alg-cndp.jpg',
    initialPositions: {
      ar: { date: { x: 490, y: 95 }, place: { x: 110, y: 95 }, beneficiary: { x: 160, y: 195 }, amount: { x: 590, y: 145 }, amountWords: { x: 160, y: 245, width: 400 } },
      fr: { date: { x: 490, y: 95 }, place: { x: 110, y: 95 }, beneficiary: { x: 160, y: 195 }, amount: { x: 590, y: 145 }, amountWords: { x: 160, y: 245, width: 400 } },
    },
  },
  {
    id: 'cpa_dz',
    name: 'القرض الشعبي الجزائري (CPA)',
    name_fr: 'Crédit Populaire d\'Algérie (CPA)',
    checkImageUrl: '/banks/alg-cpa.jpg',
    initialPositions: {
      ar: { date: { x: 490, y: 95 }, place: { x: 110, y: 95 }, beneficiary: { x: 160, y: 195 }, amount: { x: 590, y: 145 }, amountWords: { x: 160, y: 245, width: 400 } },
      fr: { date: { x: 490, y: 95 }, place: { x: 110, y: 95 }, beneficiary: { x: 160, y: 195 }, amount: { x: 590, y: 145 }, amountWords: { x: 160, y: 245, width: 400 } },
    },
  },
  {
    id: 'gulf_dz',
    name: 'بنك الخليج الجزائر',
    name_fr: 'Gulf Bank Algérie',
    checkImageUrl: '/banks/alg-gulf3.jpg',
    initialPositions: {
      ar: { date: { x: 505, y: 115 }, place: { x: 115, y: 115 }, beneficiary: { x: 165, y: 215 }, amount: { x: 615, y: 165 }, amountWords: { x: 165, y: 265, width: 400 } },
      fr: { date: { x: 505, y: 115 }, place: { x: 115, y: 115 }, beneficiary: { x: 165, y: 215 }, amount: { x: 615, y: 165 }, amountWords: { x: 165, y: 265, width: 400 } },
    },
  },
  {
    id: 'housing_dz',
    name: 'بنك الإسكان للتجارة والتمويل',
    name_fr: 'Housing Bank For Trade & Finance',
    checkImageUrl: '/banks/alg-hous.jpg',
    initialPositions: {
      ar: { date: { x: 500, y: 100 }, place: { x: 100, y: 100 }, beneficiary: { x: 150, y: 200 }, amount: { x: 600, y: 150 }, amountWords: { x: 150, y: 250, width: 400 } },
      fr: { date: { x: 500, y: 100 }, place: { x: 100, y: 100 }, beneficiary: { x: 150, y: 200 }, amount: { x: 600, y: 150 }, amountWords: { x: 150, y: 250, width: 400 } },
    },
  },
  {
    id: 'ntx_dz',
    name: 'بنك NTX (عام)',
    name_fr: 'NTX Bank (Générique)',
    checkImageUrl: '/banks/alg-ntx.jpg',
    initialPositions: {
      ar: { date: { x: 510, y: 90 }, place: { x: 110, y: 90 }, beneficiary: { x: 160, y: 190 }, amount: { x: 610, y: 140 }, amountWords: { x: 160, y: 240, width: 400 } },
      fr: { date: { x: 510, y: 90 }, place: { x: 110, y: 90 }, beneficiary: { x: 160, y: 190 }, amount: { x: 610, y: 140 }, amountWords: { x: 160, y: 240, width: 400 } },
    },
  },
  {
    id: 'sga_dz',
    name: 'سوسيتيه جنرال الجزائر',
    name_fr: 'Société Générale Algérie',
    checkImageUrl: '/banks/alg-sga.jpg',
    initialPositions: {
      ar: { date: { x: 495, y: 105 }, place: { x: 105, y: 105 }, beneficiary: { x: 155, y: 205 }, amount: { x: 595, y: 155 }, amountWords: { x: 155, y: 255, width: 400 } },
      fr: { date: { x: 495, y: 105 }, place: { x: 105, y: 105 }, beneficiary: { x: 155, y: 205 }, amount: { x: 595, y: 155 }, amountWords: { x: 155, y: 255, width: 400 } },
    },
  },
  {
    id: 'slm_dz',
    name: 'بنك SLM (عام)',
    name_fr: 'SLM Bank (Générique)',
    checkImageUrl: '/banks/alg-slm2.jpg',
    initialPositions: {
      ar: { date: { x: 500, y: 95 }, place: { x: 100, y: 95 }, beneficiary: { x: 150, y: 195 }, amount: { x: 600, y: 145 }, amountWords: { x: 150, y: 245, width: 400 } },
      fr: { date: { x: 500, y: 95 }, place: { x: 100, y: 95 }, beneficiary: { x: 150, y: 195 }, amount: { x: 600, y: 145 }, amountWords: { x: 150, y: 245, width: 400 } },
    },
  },
  {
    id: 'trust_dz',
    name: 'بنك الثقة الجزائر',
    name_fr: 'Trust Bank Algérie',
    checkImageUrl: '/banks/alg-trust.jpg',
    initialPositions: {
      ar: { date: { x: 520, y: 100 }, place: { x: 100, y: 100 }, beneficiary: { x: 150, y: 200 }, amount: { x: 600, y: 150 }, amountWords: { x: 150, y: 250, width: 400 } },
      fr: { date: { x: 520, y: 100 }, place: { x: 100, y: 100 }, beneficiary: { x: 150, y: 200 }, amount: { x: 600, y: 150 }, amountWords: { x: 150, y: 250, width: 400 } },
    },
  },
];

const App: React.FC = () => {
  const [language, setLanguage] = useState<'ar' | 'fr'>(() => {
    return (localStorage.getItem('language') as 'ar' | 'fr') || 'ar';
  });

  const t = translations[language];

  const [checkData, setCheckData] = useState<CheckData>({
    date: '',
    place: '',
    beneficiary: '',
    amount: '',
  });

  const [banks, setBanks] = useState<Bank[]>(initialBanks);
  const [selectedBank, setSelectedBank] = useState<Bank>(() => {
    const savedBankId = localStorage.getItem('selectedBankId');
    return initialBanks.find(b => b.id === savedBankId) || initialBanks[0];
  });

  const [currentPositions, setCurrentPositions] = useState<Record<string, Position>>(() => {
    const savedPositions = localStorage.getItem(`positions_${selectedBank.id}_${language}`);
    if (savedPositions) {
      return JSON.parse(savedPositions);
    }
    return selectedBank.initialPositions[language];
  });

  const [showPositionControls, setShowPositionControls] = useState(false);

  useEffect(() => {
    const savedPositions = localStorage.getItem(`positions_${selectedBank.id}_${language}`);
    if (savedPositions) {
      setCurrentPositions(JSON.parse(savedPositions));
    } else {
      setCurrentPositions(selectedBank.initialPositions[language]);
    }
    localStorage.setItem('selectedBankId', selectedBank.id);
  }, [selectedBank, language]);

  useEffect(() => {
    localStorage.setItem(`positions_${selectedBank.id}_${language}`, JSON.stringify(currentPositions));
  }, [currentPositions, selectedBank.id, language]);

  const toggleLanguage = useCallback(() => {
    setLanguage(prevLang => {
      const newLang = prevLang === 'ar' ? 'fr' : 'ar';
      localStorage.setItem('language', newLang);
      return newLang;
    });
  }, []);

  const handleBankChange = useCallback((bank: Bank) => {
    setSelectedBank(bank);
  }, []);

  const resetCurrentPositions = useCallback(() => {
    setCurrentPositions(selectedBank.initialPositions[language]);
  }, [selectedBank, language]);

  return (
    <div className="min-h-screen gradient-bg text-gray-800 relative z-0 py-8 px-4 md:px-6">
      <header className="max-w-7xl mx-auto flex justify-between items-center mb-8 md:mb-12 no-print">
        <div className="flex items-center gap-3">
          <Sparkles className="w-7 h-7 md:w-8 md:h-8 text-yellow-400 floating-animation" />
          <h1 className="text-xl md:text-2xl font-extrabold text-white">
            {t.electronicCheckFilling}
          </h1>
        </div>
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-full backdrop-blur-sm hover:bg-white/30 transition-colors"
        >
          <Languages className="w-5 h-5" />
          <span className="font-medium text-sm">{language === 'ar' ? 'Français' : 'العربية'}</span>
        </button>
      </header>

      <main className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          <div className="fade-in no-print">
            <CheckForm
              checkData={checkData}
              setCheckData={setCheckData}
              positions={currentPositions}
              setPositions={setCurrentPositions}
              showPositionControls={showPositionControls}
              setShowPositionControls={setShowPositionControls}
              banks={banks}
              selectedBank={selectedBank}
              setSelectedBank={handleBankChange}
              language={language}
              t={t}
            />
            <div className="mt-4">
                <button
                    onClick={resetCurrentPositions}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-colors"
                >
                    <Sparkles className="w-4 h-4" />
                    <span>{t.resetPositions}</span>
                </button>
            </div>
          </div>

          {/* 👇 التعديل هنا فقط: أضفنا كلاس check-preview-container  */}
          <div className="space-y-4 md:space-y-6 fade-in check-preview-container" style={{ animationDelay: '0.3s' }}>
            <CheckPreview
              checkData={checkData}
              positions={currentPositions}
              setPositions={setCurrentPositions}
              checkImageUrl={selectedBank.checkImageUrl}
              language={language}
              t={t}
            />
          </div>
        </div>
      </main>


      <footer className="relative z-10 bg-gradient-to-r from-gray-900 to-gray-800 text-white mt-8 md:mt-16 no-print">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 text-center">
              <p className="text-gray-400 text-xs md:text-sm">
                © 2024 All Rights Reserved - Developed by
                <a href="https://aissam.dev" className="text-yellow-400 hover:text-yellow-300 font-bold ms-1" target="_blank" rel="noopener noreferrer">Aissam Nedjar</a>
              </p>
          </div>
      </footer>
    </div>
  );
};

export default App;