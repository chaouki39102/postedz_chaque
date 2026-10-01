import React, { useEffect, useState } from 'react';
import { X, Database, Landmark, Languages, Save, FolderOpen, Printer, Type } from 'lucide-react';
import { useLabelProxy } from '../../context/labelsCore';
import type { PrintLayoutApi } from '../../hooks/usePrintLayout';
import BanksTab from './BanksTab';
import DefaultsTab from './DefaultsTab';
import PresetsTab from './PresetsTab';
import LabelsTab from './LabelsTab';
import DataTab from './DataTab';
import FontsTab from './FontsTab';
import PrintTab from './PrintTab';
import type { PositionMap } from '../../types';

export type ManageTab = 'banks' | 'defaults' | 'presets' | 'labels' | 'fonts' | 'print' | 'data';

interface ManagementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onBanksChanged: () => Promise<void> | void;
  onPresetsChanged: () => Promise<void> | void;
  onDatabaseReplaced: () => Promise<void> | void;
  activeBankId: string;
  onSelectBank: (id: string) => void;
  /** تفضيلات الطباعة: الهوامش ومحرّكها */
  printLayout: PrintLayoutApi;
  /** مواضع الحقول: يتحرّك منها موضع المبلغ داخل الشيك */
  positions: PositionMap;
  setPositions: (updater: (current: PositionMap) => PositionMap) => void;
}

/**
 * لوحة إدارة كل ما في قاعدة البيانات.
 *
 * وجودها الآن ضرورة لا رفاهية: البيانات كلها في القاعدة (البنوك
 * والصور والتسميات والقيم الافتراضية والسجل)، فمن يملك القاعدة يملك
 * تعديلها. واجهة إدارة لكل كيان موجود بغيابها بيانات لا يستطيع
 * المستخدم قراءتها ولا تصحيحها.
 *
 * الشكل ثابت عن قصد: نفس العرض ونفس الارتفاع في كل التبويبات
 * (انظر src/styles/settings-panel.css). لولا ذلك لقفزت النافذة عند كل
 * تبديل tab، ومعها قفز موضع ما تحت يد المستخدم.
 */
const TABS: Array<{ id: ManageTab; icon: React.ReactNode }> = [
  { id: 'banks', icon: <Landmark className="w-4 h-4" aria-hidden="true" /> },
  { id: 'defaults', icon: <Save className="w-4 h-4" aria-hidden="true" /> },
  { id: 'presets', icon: <FolderOpen className="w-4 h-4" aria-hidden="true" /> },
  { id: 'labels', icon: <Languages className="w-4 h-4" aria-hidden="true" /> },
  { id: 'fonts', icon: <Type className="w-4 h-4" aria-hidden="true" /> },
  { id: 'print', icon: <Printer className="w-4 h-4" aria-hidden="true" /> },
  { id: 'data', icon: <Database className="w-4 h-4" aria-hidden="true" /> },
];

const ManagementPanel: React.FC<ManagementPanelProps> = ({
  isOpen,
  onClose,
  onBanksChanged,
  onPresetsChanged,
  onDatabaseReplaced,
  activeBankId,
  onSelectBank,
  printLayout,
  positions,
  setPositions,
}) => {
  const currentLabels = useLabelProxy('manage.');
  const [tab, setTab] = useState<ManageTab>('banks');

  /*
   * Esc للإغلاق. لولا هذا لكان المستخدم يحتاج الفأرة لإغلاق نافذة
   * ملأت الشاشة، وهي عادة قديمة لكنها أرحم من الاختناق في زاوية.
   *
   * `body` مقفل أثناء فتح اللوحة: التمرير في الخلفية يحرّك الصفحة
   * تحتها فيوهم المستخدم أن اللوحة تنزلق معه.
   */
  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="sp-overlay" role="dialog" aria-modal="true" aria-label={currentLabels.title}>
      <div id="management-panel" className="sp-shell">
        <header className="sp-head">
          <span className="sp-head__rule" aria-hidden="true" />
          <div className="sp-head__text">
            <h2 className="sp-head__title">{currentLabels.title}</h2>
            <p className="sp-head__sub">{currentLabels.subtitle}</p>
          </div>
          <button
            type="button"
            className="sp-head__close"
            onClick={onClose}
            aria-label={currentLabels.close}
            title={currentLabels.close}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </header>

        <div className="sp-body">
          <nav className="sp-rail" aria-label={currentLabels.title}>
            {TABS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-pressed={tab === item.id}
                aria-current={tab === item.id}
                className="sp-rail__item"
                data-tab={item.id}
              >
                <span className="sp-rail__index">{String(index + 1).padStart(2, '0')}</span>
                <span className="sp-rail__icon">{item.icon}</span>
                <span className="sp-rail__label">{currentLabels[`${item.id}Tab`]}</span>
              </button>
            ))}
          </nav>

          <section className="sp-pane" data-tab={tab}>
            {/*
             * التبويب غير المفتوح لا يُركَّب أصلاً: بناء ستة تبويبات عند
             * كل فتح (بنوك، صور،数百 التسميات، إحصاء القاعدة) أبطأ من
             * اللازم بلا فائدة. الارتفاع ثابت من CSS فلا يتأثر شكل
             * النافذة بما يُركَّب فيها.
             */}
            {tab === 'banks' && (
              <BanksTab onChanged={onBanksChanged} onSelectBank={onSelectBank} />
            )}
            {tab === 'defaults' && <DefaultsTab />}
            {tab === 'presets' && (
              <PresetsTab activeBankId={activeBankId} onChanged={onPresetsChanged} />
            )}
            {tab === 'labels' && <LabelsTab />}
            {tab === 'fonts' && (
              <FontsTab positions={positions} setPositions={setPositions} />
            )}
            {tab === 'print' && (
              <PrintTab printLayout={printLayout} positions={positions} setPositions={setPositions} />
            )}
            {tab === 'data' && <DataTab onReplaced={onDatabaseReplaced} />}
          </section>
        </div>
      </div>
    </div>
  );
};

export default ManagementPanel;
