import React, { useState, useRef, useCallback, useEffect } from "react";
import { Printer, Eye, Sparkles, Move, Lock, Unlock } from "lucide-react";
import {
  numberToArabicWords,
  numberToFrenchWords,
} from "../utils/numberToWords";
import { CheckData, Position, Language, Bank } from "../types";

const CheckPreview: React.FC<{
  checkData: CheckData;
  positions: Record<string, Position>;
  setPositions: (positions: Record<string, Position>) => void;
  language: Language;
  bank: Bank;
}> = ({ checkData, positions, setPositions, language, bank }) => {
  const [draggedElement, setDraggedElement] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialPosition, setInitialPosition] = useState({ x: 0, y: 0 });
  const [isLocked, setIsLocked] = useState(false);
  const checkRef = useRef<HTMLDivElement>(null);

  const labels = {
    ar: {
      preview: "معاينة الشيك",
      locked: "مقفل",
      unlocked: "مفتوح",
      reset: "إعادة تعيين",
      print: "طباعة",
      dragIndicator: "جاري السحب...",
      positionTips: "تعليمات التحكم المحسنة",
      editMode: "وضع التحرير",
      drag: "السحب",
      lockMode: "وضع القفل",
      resetPos: "إعادة تعيين",
      amountInWords: "المبلغ بالحروف",
      autoConvert: "تم التحويل تلقائياً بواسطة النظام الذكي",
      printTips: "نصائح الطباعة",
      printTip1: "سيتم طباعة النصوص فقط على الشيك الحقيقي",
      printTip2: "تأكد من وضع الشيك بشكل صحيح في الطابعة",
      printTip3: "النصوص ستظهر بالمواضع المحددة بدقة",
      checkData: "بيانات الشيك",
      date: "التاريخ:",
      place: "مكان التحرير:",
      beneficiary: "المستفيد:",
      amount: "المبلغ:",
      amountInWordsLabel: "المبلغ بالحروف:",
      currency: "",
      currencyWords: "",
      dragTitle: "اسحب لتغيير الموضع",
      lockedTitle: "مقفل - اضغط على زر الفتح للتحرير",
    },
    fr: {
      preview: "Aperçu du chèque",
      locked: "Verrouillé",
      unlocked: "Déverrouillé",
      reset: "Réinitialiser",
      print: "Imprimer",
      dragIndicator: "Glissement en cours...",
      positionTips: "Instructions de contrôle améliorées",
      editMode: "Mode édition",
      drag: "Glisser",
      lockMode: "Mode verrouillage",
      resetPos: "Réinitialiser",
      amountInWords: "Montant en lettres",
      autoConvert: "Converti automatiquement par le système intelligent",
      printTips: "Conseils d'impression",
      printTip1: "Seuls les textes seront imprimés sur le vrai chèque",
      printTip2:
        "Assurez-vous de placer le chèque correctement dans l'imprimante",
      printTip3:
        "Les textes apparaîtront aux positions définies avec précision",
      checkData: "Données du chèque",
      date: "Date:",
      place: "Lieu:",
      beneficiary: "Bénéficiaire:",
      amount: "Montant:",
      amountInWordsLabel: "Montant en lettres:",
      currency: "",
      currencyWords: "",
      dragTitle: "Glisser pour changer la position",
      lockedTitle:
        "Verrouillé - Cliquez sur le bouton de déverrouillage pour éditer",
    },
  };

  const currentLabels = labels[language];

  const formatCurrency = (num: number): string => {
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (language === "ar") {
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } else {
      return date.toLocaleDateString("fr-FR");
    }
  };

  const getAmountInWords = (): string => {
    if (!checkData.amount || isNaN(Number(checkData.amount))) return "";
    const amount = Number(checkData.amount);
    return language === "ar"
      ? numberToArabicWords(amount)
      : numberToFrenchWords(amount);
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, elementType: string) => {
      if (isLocked) return;

      e.preventDefault();
      e.stopPropagation();

      const checkRect = checkRef.current?.getBoundingClientRect();
      if (!checkRect) return;

      setDraggedElement(elementType);
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setInitialPosition(positions[elementType] || { x: 0, y: 0 });

      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
    },
    [isLocked, positions]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !draggedElement || !checkRef.current) return;

      e.preventDefault();

      const checkRect = checkRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      let deltaXPercent = (deltaX / checkRect.width) * 100;
      let deltaYPercent = (deltaY / checkRect.height) * 100;

      // Only negate deltaX for right-aligned elements in the context of dragging
      // The renderDraggableElement will correctly apply 'right' and transform: translate(50%, -50%)
      if (
        draggedElement === "beneficiary" ||
        draggedElement === "amountWords"
      ) {
        deltaXPercent = -deltaXPercent;
      }

      const newX = Math.max(
        -100,
        Math.min(200, initialPosition.x + deltaXPercent)
      );
      const newY = Math.max(
        -100,
        Math.min(200, initialPosition.y + deltaYPercent)
      );

      setPositions({
        ...positions,
        [draggedElement]: {
          ...positions[draggedElement],
          x: Math.round(newX),
          y: Math.round(newY),
        },
      });
    },
    [
      isDragging,
      draggedElement,
      dragStart,
      initialPosition,
      positions,
      setPositions,
    ]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setDraggedElement(null);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handlePrint = () => {
    document.body.classList.add("printing-mode");

    const checkElement = document.getElementById("check-preview");
    if (!checkElement) {
      alert(
        language === "ar"
          ? "خطأ: لا يمكن العثور على منطقة الشيك"
          : "Erreur: Zone de chèque introuvable"
      );
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert(
        language === "ar"
          ? "خطأ: تم حظر النافذة المنبثقة"
          : "Erreur: Pop-up bloqué"
      );
      return;
    }

    const amountWordsMaxWidth = positions.amountWords?.width
      ? `${positions.amountWords.width}px`
      : "auto";

    const printContent = `
      <!DOCTYPE html>
      <html dir="${language === "ar" ? "rtl" : "ltr"}">
      <head>
        <meta charset="UTF-8">
        <title>${
          language === "ar" ? "طباعة الشيك" : "Impression du chèque"
        }</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Cairo', Arial, sans-serif;
          }
          
          @page {
            size: A4 landscape;
            margin: 70mm 50mm;
          }
          
          body {
            background: transparent;
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
          }
          
          .check-container {
            position: relative;
            width: 210mm;
            height: 99mm;
            background-image: url('${bank.checkImageUrl}') !important;
            background-size: contain !important;
            background-repeat: no-repeat !important;
            background-position: center !important;
            page-break-inside: avoid;
          }
          
          .text-element {
            position: absolute;
            color: #000000;
            font-family: 'Cairo', Arial, sans-serif;
            font-weight: bold;
            white-space: nowrap;
            line-height: 1.2;
            background: transparent;
          }
          
          .date { font-size: 12pt; }
          .place { font-size: 12pt; }
          .beneficiary { 
            font-size: 13pt; 
            font-weight: 600; 
          }
          .amount { font-size: 12pt; }
          .amount-words { 
            font-size: 11pt; 
            max-width: ${amountWordsMaxWidth};
            word-wrap: break-word; 
            white-space: normal; 
            line-height: 1.1; 
          }
          
          * {
            background-image: none !important;
            background-color: transparent !important;
            border: none !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }
          
          @media print {
            body {
              display: flex !important;
              justify-content: center !important;
              align-items: center !important;
              margin: 0 !important;
              padding: 0 !important;
              height: 100vh !important;
            }
            
            .check-container {
              margin: 0 !important;
              position: relative !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="check-container">
          ${
            checkData.date
              ? `<div class="text-element date" style="left: ${
                  positions.date?.x || 0
                }%; top: ${
                  positions.date?.y || 0
                }%; transform: translate(-50%, -50%);">${formatDate(
                  checkData.date
                )}</div>`
              : ""
          }
          ${
            checkData.place
              ? `<div class="text-element place" style="left: ${
                  positions.place?.x || 0
                }%; top: ${
                  positions.place?.y || 0
                }%; transform: translate(-50%, -50%);">${checkData.place}</div>`
              : ""
          }
          ${
            checkData.beneficiary
              ? `<div class="text-element beneficiary" style="right: ${
                  positions.beneficiary?.x || 0
                }%; top: ${
                  positions.beneficiary?.y || 0
                }%; transform: translate(50%, -50%);">${
                  checkData.beneficiary
                }</div>`
              : ""
          }
          ${
            checkData.amount
              ? `<div class="text-element amount" style="left: ${
                  positions.amount?.x || 0
                }%; top: ${
                  positions.amount?.y || 0
                }%; transform: translate(-50%, -50%);">${formatCurrency(
                  Number(checkData.amount)
                )} ${currentLabels.currency}</div>`
              : ""
          }
          ${
            checkData.amount
              ? `<div class="text-element amount-words" style="right: ${
                  positions.amountWords?.x || 0
                }%; top: ${
                  positions.amountWords?.y || 0
                }%; transform: translate(50%, -50%);">${getAmountInWords()} ${
                  currentLabels.currencyWords
                }</div>`
              : ""
          }
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        setTimeout(() => {
          printWindow.close();
          document.body.classList.remove("printing-mode");
        }, 1000);
      }, 500);
    };
  };

  const resetPositions = () => {
    setPositions(bank.initialPositions[language]);
  };

  const renderDraggableElement = (
    elementType: string,
    value: string,
    colorClass: string,
    position: Position,
    isRightAligned = false // تم استخدام هذه القيمة الآن بشكل صحيح
  ) => {
    if (!value) return null;

    return (
      <div
        className={`absolute text-sm font-bold text-black dark:text-white select-none drop-shadow-sm transition-all duration-200 px-3 py-1.5 rounded-lg print-text ${
          !isLocked
            ? `cursor-grab hover:bg-${colorClass}-100/70 dark:hover:bg-${colorClass}-900/30 hover:border-2 hover:border-${colorClass}-500`
            : "cursor-default"
        } ${
          draggedElement === elementType
            ? `bg-${colorClass}-200/80 dark:bg-${colorClass}-800/50 border-2 border-${colorClass}-600 dark:border-${colorClass}-400 shadow-lg scale-105 z-50`
            : ""
        }`}
        style={{
          [isRightAligned ? 'right' : 'left']: `${position.x}%`, // تم التغيير هنا
          top: `${position.y}%`,
          transform: `translate(${isRightAligned ? '50%' : '-50%'}, -50%)`, // تم التغيير هنا
          fontFamily: "Cairo, sans-serif",
          maxWidth: position.width ? `${position.width}px` : "none",
          whiteSpace: elementType === "amountWords" ? "normal" : "nowrap",
          wordBreak: elementType === "amountWords" ? "break-word" : "normal",
          width: elementType === "amountWords" && position.width ? `${position.width}px` : "auto"
        }}
        onMouseDown={(e) => handleMouseDown(e, elementType)}
        title={isLocked ? currentLabels.lockedTitle : currentLabels.dragTitle}
      >
        {!isLocked && (
          <Move
            className={`w-3 h-3 text-${colorClass}-600 dark:text-${colorClass}-400 absolute -top-1 -right-1 opacity-60 hover:opacity-100 transition-opacity no-print`}
          />
        )}
        {value}
      </div>
    );
  };

  return (
    <div className="bg-white/90 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover-lift transition-shadow hover:shadow-xl">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-5 py-4 no-print">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-1.5 rounded-lg">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">
              {currentLabels.preview}
            </h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsLocked(!isLocked)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all duration-300 font-medium text-sm backdrop-blur-sm border border-white/20 hover:scale-105 ${
                isLocked
                  ? "bg-red-500/90 text-white hover:bg-red-600"
                  : "bg-amber-500 text-white hover:bg-amber-600"
              }`}
            >
              {isLocked ? (
                <Lock className="w-4 h-4" />
              ) : (
                <Unlock className="w-4 h-4" />
              )}
              <span>
                {isLocked ? currentLabels.locked : currentLabels.unlocked}
              </span>
            </button>
            <button
              onClick={resetPositions}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-300 font-medium text-sm backdrop-blur-sm border border-white/20 hover:scale-105"
            >
              <Move className="w-4 h-4" />
              <span>{currentLabels.reset}</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all duration-300 font-medium text-sm backdrop-blur-sm border border-white/20 hover:scale-105"
            >
              <Printer className="w-4 h-4" />
              <span>{currentLabels.print}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-5">
        {/* منطقة المعاينة والطباعة */}
        <div
          ref={checkRef}
          id="check-preview"
          className="relative w-full max-w-4xl mx-auto bg-center bg-no-repeat bg-contain rounded-xl overflow-hidden shadow-md border border-gray-300 dark:border-gray-600 screen-only"
          style={{
            backgroundImage: `url('${bank.checkImageUrl}')`,
            paddingBottom: "45%",
            minHeight: "320px",
            cursor: isDragging ? "grabbing" : "default",
          }}
        >
          {/* التاريخ */}
          {renderDraggableElement(
            "date",
            formatDate(checkData.date),
            "blue",
            positions.date || { x: 0, y: 0 }
          )}

          {/* المكان */}
          {renderDraggableElement(
            "place",
            checkData.place,
            "green",
            positions.place || { x: 0, y: 0 }
          )}

          {/* المستفيد */}
          {renderDraggableElement(
            "beneficiary",
            checkData.beneficiary,
            "purple",
            positions.beneficiary || { x: 0, y: 0 },
            true
          )}

          {/* المبلغ بالأرقام */}
          {renderDraggableElement(
            "amount",
            checkData.amount
              ? `${formatCurrency(Number(checkData.amount))} ${
                  currentLabels.currency
                }`
              : "",
            "yellow",
            positions.amount || { x: 0, y: 0 }
          )}

          {/* المبلغ بالحروف */}
          {renderDraggableElement(
            "amountWords",
            checkData.amount
              ? `${getAmountInWords()} ${currentLabels.currencyWords}`
              : "",
            "orange",
            positions.amountWords || { x: 0, y: 0 },
            true
          )}

          {/* مؤشر السحب */}
          {isDragging && draggedElement && (
            <div className="absolute top-4 left-4 bg-black/80 text-white px-3 py-2 rounded-lg text-sm font-medium z-50 no-print">
              {currentLabels.dragIndicator} ({draggedElement})
            </div>
          )}
        </div>

        {/* تعليمات السحب والإفلات */}
        <div className="mt-4 bg-gradient-to-r from-blue-50 to-amber-50 dark:from-blue-900/20 dark:to-amber-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 no-print">
          <div className="flex items-center gap-2 mb-3">
            <Move className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-blue-800 dark:text-blue-200">
              {currentLabels.positionTips}
            </h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <p className="text-blue-700 dark:text-blue-300 font-medium">
                🔓 <strong>{currentLabels.editMode}:</strong>{" "}
                {currentLabels.drag}
              </p>
              <p className="text-blue-700 dark:text-blue-300 font-medium">
                🖱️ <strong>{currentLabels.drag}:</strong> {currentLabels.drag}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-green-700 dark:text-green-300 font-medium">
                🔒 <strong>{currentLabels.lockMode}:</strong>{" "}
                {currentLabels.lockMode}
              </p>
              <p className="text-green-700 dark:text-green-300 font-medium">
                ↩️ <strong>{currentLabels.resetPos}:</strong>{" "}
                {currentLabels.resetPos}
              </p>
            </div>
          </div>
        </div>

        {/* معلومات المعاينة */}
        <div className="mt-5 no-print">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
            <h3 className="font-bold text-green-800 dark:text-green-200 mb-3 text-sm flex items-center gap-2">
              <div className="bg-green-100 dark:bg-green-900/30 p-1.5 rounded-lg">
                <Sparkles className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              {currentLabels.amountInWords}
            </h3>
            <div className="bg-white/80 dark:bg-gray-700/80 p-3 rounded-lg">
              <p
                className="text-green-700 dark:text-green-300 font-medium text-sm leading-relaxed"
                dir="ltr"
              >
                {checkData.amount
                  ? `${getAmountInWords()} ${currentLabels.currencyWords}`
                  : language === "ar"
                  ? "أدخل المبلغ لرؤية التحويل التلقائي"
                  : "Entrez le montant pour voir la conversion automatique"}
              </p>
            </div>
            {checkData.amount && (
              <div className="mt-3 p-2.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <p className="text-green-800 dark:text-green-200 text-sm font-medium">
                  ✨ {currentLabels.autoConvert}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* تحذير الطباعة */}
        <div className="mt-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800 no-print">
          <div className="flex items-center gap-2 mb-3">
            <Printer className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200">
              {currentLabels.printTips}
            </h3>
          </div>
          <div className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
            <p>• {currentLabels.printTip1}</p>
            <p>• {currentLabels.printTip2}</p>
            <p>• {currentLabels.printTip3}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckPreview;