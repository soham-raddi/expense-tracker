// Colours and spacing for the whole app. Light and dark follow the phone's setting.

import { useColorScheme } from 'react-native';

export interface Palette {
  background: string;
  card: string;
  cardAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  accentSoft: string;
  debit: string;
  credit: string;
  debitSoft: string;
  creditSoft: string;
  warning: string;
  warningSoft: string;
}

const light: Palette = {
  background: '#F4F6FA',
  card: '#FFFFFF',
  cardAlt: '#EEF1F7',
  border: '#E1E5EE',
  text: '#141A26',
  textMuted: '#6B7385',
  accent: '#3F5BD9',
  onAccent: '#FFFFFF',
  accentSoft: '#E4E9FB',
  debit: '#C2364A',
  credit: '#1E8E6A',
  debitSoft: '#FBE9EC',
  creditSoft: '#E0F4EC',
  warning: '#B26A00',
  warningSoft: '#FFF1D6',
};

const dark: Palette = {
  background: '#0E1220',
  card: '#171C2E',
  cardAlt: '#1F2538',
  border: '#2A3148',
  text: '#EEF1FA',
  textMuted: '#98A0B8',
  accent: '#7B93FF',
  onAccent: '#0E1220',
  accentSoft: '#26305A',
  debit: '#FF7A8C',
  credit: '#4FD1A1',
  debitSoft: '#3A2230',
  creditSoft: '#18382F',
  warning: '#FFC261',
  warningSoft: '#3B3018',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;
