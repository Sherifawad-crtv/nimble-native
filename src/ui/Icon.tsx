import { memo } from 'react';
import { SvgXml } from 'react-native-svg';
import { SOLAR_ICONS } from './solar-icons';
import { color } from './theme';

const FLIP = new Set(['chev-l', 'chev-r']);

/** Solar icons from the web app's set, drawn with react-native-svg. */
export const Icon = memo(function Icon({ name, size = 24, tint = color.ink }: { name: string; size?: number; tint?: string }) {
  const body = SOLAR_ICONS[name];
  if (!body) return null;
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" color="${tint}">${body}</svg>`;
  return <SvgXml xml={xml} width={size} height={size} color={tint} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={FLIP.has(name) ? { transform: [{ scaleX: 1 }] } : undefined} />;
});
