import React, { useState, useEffect } from 'react';
import CheckForm from './components/CheckForm';
import CheckPreview from './components/CheckPreview';
import { Sparkles, Globe, BookOpen, Award, Shield, Zap, Users, Sun, Moon } from 'lucide-react';
import { initialBanks, getBankById } from './banksData';
import { CheckData, Language, Bank, Position } from './types';
import { useDirection } from './hooks/useDirection';

const App: React.FC = () => {
  const [currentBank, setCurrentBank] = useState<Bank>(initialBanks[0]);
  const [language, setLanguage] = useState<Language>('ar');
  const [checkData, setCheckData] = useState<CheckData>({
    date: '',
    place: language === 'fr' ? 'EL-OUED' : 'الوادي',
    beneficiary: language === 'fr' ? 'SARL ELHADJ ALI BAYOUDH COMMERCE' : 'شركة الحاج علي بيوض للتجارة ذ م م',
    amount: '500000.00',
  });
  const [positions, setPositions] = useState<Record<string, Position>>({});

  useDirection(language);

  useEffect(() => {
    const today = new Date();
    setCheckData(prev => ({
      ...prev,
      date: today.toISOString().split('T')[0]
    }));
  }, []);

  useEffect(() => {
    const savedPositions = localStorage.getItem(`bank_positions_${currentBank.id}_${language}`);
    const initialPositions = currentBank.initialPositions[language];
    setPositions(savedPositions ? JSON.parse(savedPositions) : initialPositions);
  }, [currentBank, language]);

  useEffect(() => {
    if (Object.keys(positions).length > 0) {
      localStorage.setItem(`bank_positions_${currentBank.id}_${language}`, JSON.stringify(positions));
    }
  }, [positions, currentBank.id, language]);

  const handleBankChange = (bankId: string) => {
    const bank = getBankById(bankId);
    if (bank) setCurrentBank(bank);
  };

  const toggleLanguage = () => {
    const newLang = language === 'ar' ? 'fr' : 'ar';
    setLanguage(newLang);
    setCheckData(prev => ({
      ...prev,
      place: newLang === 'fr' ? 'EL-OUED' : 'الوادي',
      beneficiary: newLang === 'fr' ? 'SARL ELHADJ ALI BAYOUDH COMMERCE' : 'شركة الحاج علي بيوض للتجارة ذ م م'
    }));
  };

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gray-900 relative overflow-hidden text-gray-800 dark:text-gray-200">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-200/30 dark:bg-indigo-900/40 rounded-full blur-3xl floating-animation"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-200/30 dark:bg-amber-900/40 rounded-full blur-3xl floating-animation" style={{ animationDelay: '3s' }}></div>
      </div>

      <header className="relative z-10 bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg border-b border-gray-200/80 dark:border-gray-700/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 slide-in">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg shadow-md">
                <img
                  src="https://www.poste.dz/images/logo-round.png"
                  alt="بريد الجزائر"
                  className="w-8 h-8 object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-700 dark:from-indigo-400 dark:to-purple-500">
                  {language === 'ar' ? 'مولّد شيكات بنوك الجزائر' : 'Générateur de Chèques AP'}
                </h1>
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium">
                  {language === 'ar' ? 'نظام ملء الشيكات بدقة وسهولة' : 'Remplissage de chèques avec précision'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleDarkMode}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                {document.documentElement.classList.contains('dark') ? (
                  <>
                    <Sun className="w-4 h-4" />
                    <span>{language === 'ar' ? 'الوضع الفاتح' : 'Light Mode'}</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4" />
                    <span>{language === 'ar' ? 'الوضع الداكن' : 'Dark Mode'}</span>
                  </>
                )}
              </button>
              <div className="hidden md:flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600">
                <Sparkles className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-300">
                  {language === 'ar' ? 'تحويل ذكي' : 'Conversion IA'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label htmlFor="bank-select" className="text-sm font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                {language === 'ar' ? 'اختر النموذج:' : 'Modèle:'}
              </label>
              <select
                id="bank-select"
                onChange={(e) => handleBankChange(e.target.value)}
                value={currentBank.id}
                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              >
                {initialBanks.map(bank => (
                  <option key={bank.id} value={bank.id}>
                    {language === 'ar' ? bank.name : bank.name_fr}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm font-medium w-full sm:w-auto justify-center"
            >
              <Globe className="w-4 h-4" />
              <span>{language === 'ar' ? 'Français' : 'العربية'}</span>
            </button>
          </div>
        </div>
      </div>
      
      <main className="relative z-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-8 fade-in">
            <CheckForm
              checkData={checkData}
              setCheckData={setCheckData}
              positions={positions}
              setPositions={setPositions}
              language={language}
              bank={currentBank}
            />
            
            <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-3">
                <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                {language === 'ar' ? 'دليل الاستخدام والمميزات' : 'Guide et Fonctionnalités'}
              </h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-4">
                  <span className="bg-indigo-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">1</span>
                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-gray-100">{language === 'ar' ? 'إدخال البيانات' : 'Saisie des données'}</h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{language === 'ar' ? 'املأ الحقول المطلوبة في النموذج أعلاه.' : 'Remplissez les champs requis dans le formulaire.'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="bg-indigo-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">2</span>
                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-gray-100">{language === 'ar' ? 'ضبط المواضع' : 'Ajuster les positions'}</h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{language === 'ar' ? 'في قسم المعاينة، اسحب النصوص لوضعها في المكان الصحيح.' : 'Faites glisser les textes pour les positionner.'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="bg-indigo-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">3</span>
                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-gray-100">{language === 'ar' ? 'الطباعة النهائية' : 'Impression finale'}</h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{language === 'ar' ? 'بعد التأكد من كل شيء، اضغط على زر الطباعة.' : 'Cliquez sur le bouton d\'impression.'}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                 <h4 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    {language === 'ar' ? 'مميزات متقدمة' : 'Fonctionnalités avancées'}
                 </h4>
                 <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-3 p-2 bg-gray-100 dark:bg-gray-700/50 rounded-lg"><Shield className="w-5 h-5 text-blue-500"/><span>{language === 'ar' ? 'حفظ تلقائي وآمن' : 'Sauvegarde sécurisée'}</span></div>
                    <div className="flex items-center gap-3 p-2 bg-gray-100 dark:bg-gray-700/50 rounded-lg"><Zap className="w-5 h-5 text-green-500"/><span>{language === 'ar' ? 'معالجة فورية' : 'Traitement rapide'}</span></div>
                    <div className="flex items-center gap-3 p-2 bg-gray-100 dark:bg-gray-700/50 rounded-lg"><Users className="w-5 h-5 text-purple-500"/><span>{language === 'ar' ? 'دعم نماذج متعددة' : 'Modèles multiples'}</span></div>
                    <div className="flex items-center gap-3 p-2 bg-gray-100 dark:bg-gray-700/50 rounded-lg"><Globe className="w-5 h-5 text-yellow-500"/><span>{language === 'ar' ? 'دعم لغتين' : 'Support bilingue'}</span></div>
                 </div>
              </div>
            </div>
          </div>

          <div className="fade-in" style={{ animationDelay: '0.2s' }}>
            <CheckPreview
              checkData={checkData}
              positions={positions}
              setPositions={setPositions}
              language={language}
              bank={currentBank}
            />
          </div>
        </div>
      </main>

      <footer className="relative z-10 bg-gray-800 dark:bg-gray-900 text-white mt-16 border-t-4 border-indigo-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center text-center md:text-right gap-6">
            <div className="flex items-center gap-3">
              <img
                src="https://www.poste.dz/images/logo-round.png"
                alt="بريد الجزائر"
                className="w-8 h-8 object-contain bg-white rounded-full p-1"
              />
              <h3 className="text-lg font-bold">
                {language === 'ar' ? 'مولّد شيكات بنوك الجزائر' : 'Générateur de Chèques'}
              </h3>
            </div>
            <p className="text-gray-400 text-sm">
              © {new Date().getFullYear()} {language === 'ar' ? 'تطوير' : 'Développé par'}
              <a href="https://ChaoukiAB.dev" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 font-bold mx-1">ABDESSADOK Chaouki</a>
              - {language === 'ar' ? 'جميع الحقوق محفوظة.' : 'Tous droits réservés.'}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;