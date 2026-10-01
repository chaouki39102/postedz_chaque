import { createContext, useContext } from 'react';
import type { StorageEngineKind } from '../data';

/**
 * حالة محرك التخزين: النواة والخطّافات.
 *
 * منفصلة عن مكوّن المزوّد (EngineProvider) لسبب قاعدة ESL في هذا
 * المشروع: ملف المكوّنات يصدّر المكوّنات فقط، وإلا تعطّل Fast Refresh.
 */
export interface EngineApi {
  kind: StorageEngineKind;
  /** سبب الرجوع للمحرك المحدود، إن حدث */
  fallbackReason: string | null;
  /** حصيلة البذرة عند أول تشغيل فقط */
  seeded: { banks: number; labels: number; images: number } | null;
}

export const EngineContext = createContext<EngineApi>({
  kind: 'sqlite',
  fallbackReason: null,
  seeded: null,
});

export const useEngine = (): EngineApi => useContext(EngineContext);

export const useEngineKind = (): StorageEngineKind => useContext(EngineContext).kind;
