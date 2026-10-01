import type { ReactNode } from 'react';
import { EngineContext, type EngineApi } from './engineCore';

/** مزوّد حالة محرك التخزين: يمرّر النتيجة إلى واجهة الإدارة والتنبيهات. */
export const EngineProvider: React.FC<{ value: EngineApi; children: ReactNode }> = ({
  value,
  children,
}) => <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
