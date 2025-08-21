export interface Position {
  x: number;
  y: number;
  width?: number;
}

export interface CheckData {
  date: string;
  place: string;
  beneficiary: string;
  amount: string;
}

export interface Bank {
  id: string;
  name: string;
  name_fr: string;
  checkImageUrl: string;
  initialPositions: {
    ar: Record<string, Position>;
    fr: Record<string, Position>;
  };
}

export type Language = 'ar' | 'fr';