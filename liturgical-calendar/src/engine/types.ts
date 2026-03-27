export type Season =
  | 'advent'
  | 'christmas'
  | 'epiphany'
  | 'septuagesima'
  | 'lent'
  | 'passiontide'
  | 'easter'
  | 'pentecost';

export type LiturgicalColor = 'white' | 'red' | 'green' | 'violet' | 'rose' | 'black';

export interface Celebration {
  name: string;
  rank: number;
  rankName: string;
  source: 'temporal' | 'sanctoral';
}

export interface CalendarDay {
  date: string;
  season: Season;
  weekRef: string;
  celebration: Celebration;
  color: LiturgicalColor;
  commemorations: string[];
  transferredFrom?: string;
  holyDayOfObligation?: boolean;
}

export type CalendarVersion = string;

export interface KalendarEntry {
  day: string;
  fileRef: string;
  name: string;
  rank: number;
  additionalEntries?: KalendarEntry[];
}

export interface TemporaEntry {
  key: string;
  fileRef: string;
}

export interface TransferEntry {
  key: string;
  value: string;
}

export interface VersionDef {
  version: string;
  kalendar: string;
  transfer: string;
  stransfer: string;
  base?: string;
  tbase?: string;
}

export interface ParsedRank {
  name: string;
  rankType: string;
  numericRank: number;
  commonRef?: string;
}
