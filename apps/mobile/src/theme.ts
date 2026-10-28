import { useColorScheme } from 'react-native';

const light = {
  bg: '#FBF7F0',
  surface: '#FFFFFF',
  surfaceAlt: '#F2ECE1',
  ink: '#1E1B2E',
  muted: '#6B6577',
  line: '#E4DCCD',
  you: '#FF5A4E',
  youSoft: '#FFE3E0',
  rival: '#3D6BFF',
  rivalSoft: '#E1E8FF',
  good: '#2E9E62',
  warn: '#D98A00',
  tile: '#FFFFFF',
  tileActive: '#FF5A4E',
  tileInk: '#1E1B2E',
};

const dark: typeof light = {
  bg: '#14121C',
  surface: '#1E1B2B',
  surfaceAlt: '#272338',
  ink: '#F4F0FA',
  muted: '#A49EB4',
  line: '#34304A',
  you: '#FF6F64',
  youSoft: '#3D2226',
  rival: '#6E91FF',
  rivalSoft: '#1F2747',
  good: '#4CC487',
  warn: '#F2B23C',
  tile: '#272338',
  tileActive: '#FF6F64',
  tileInk: '#F4F0FA',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Color Flood palette: distinct in hue and lightness so it holds up for common colour blindness. */
export const FLOOD_COLORS = ['#E8505B', '#F9A03F', '#F6D743', '#3BB273', '#3D6BFF', '#8E5CD9'] as const;
/** A symbol per colour so the game never relies on colour alone. */
export const FLOOD_SYMBOLS = ['●', '▲', '■', '◆', '★', '✚'] as const;

export const space = (n: number) => n * 8;
export const radius = { sm: 8, md: 14, lg: 22 };
export const font = {
  title: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700' as const },
  body: { fontSize: 16 },
  small: { fontSize: 13 },
  mono: { fontVariant: ['tabular-nums' as const] },
};
