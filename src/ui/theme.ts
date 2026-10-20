import type { TextStyle } from 'react-native';

/** Design tokens from the web app's tokens.json, as React Native values. */
export const color = {
  bg: '#141414',
  surfaceControl: '#2a2a2d',
  surfaceCard: '#202022',
  surfaceRaised: '#353538',
  brand: '#c9f711',
  onBrand: '#000000',
  blue: '#2f8cff',
  pink: '#ff6a2b',
  green: '#5be37d',
  ink: '#ffffff',
  muted: '#8e8e93',
  faint: '#5a5a5e',
  danger: '#ff5a5f',
  warning: '#ffb340',
  line: '#2e2e31',
  lineStrong: '#4a4a4e',
  fieldBg: '#2e2e31',
  fieldEdge: '#46464b',
  scrim: 'rgba(0,0,0,0.8)',
  glass: 'rgba(32,32,34,0.85)',
} as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40 } as const;
export const radius = { md: 16, card: 24, sheet: 28, pill: 999 } as const;
export const size = { tap: 44, control: 56, pill: 52, tab: 49 } as const;

export const font = {
  displayBold: 'Urbanist_700Bold',
  displaySemi: 'Urbanist_600SemiBold',
  sans: 'RedHatDisplay_400Regular',
  sansMedium: 'RedHatDisplay_500Medium',
  sansSemi: 'RedHatDisplay_600SemiBold',
  sansBold: 'RedHatDisplay_700Bold',
} as const;

export type Variant = 'headline' | 'title' | 'heading' | 'eyebrow' | 'stat' | 'metric' | 'body' | 'bodyStrong' | 'label' | 'caption' | 'chip' | 'button' | 'input';

export const type: Record<Variant, TextStyle> = {
  headline: { fontFamily: font.displayBold, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  title: { fontFamily: font.displayBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  heading: { fontFamily: font.displaySemi, fontSize: 20, lineHeight: 24 },
  eyebrow: { fontFamily: font.displaySemi, fontSize: 18, lineHeight: 22 },
  stat: { fontFamily: font.displaySemi, fontSize: 22, lineHeight: 28 },
  metric: { fontFamily: font.displaySemi, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: font.sans, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: font.sansSemi, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: font.sansMedium, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: font.sans, fontSize: 13, lineHeight: 16 },
  chip: { fontFamily: font.sansSemi, fontSize: 13, lineHeight: 16 },
  button: { fontFamily: font.displaySemi, fontSize: 16, lineHeight: 22, letterSpacing: 0.4 },
  input: { fontFamily: font.sansMedium, fontSize: 17, lineHeight: 22 },
};

export type Tone = 'brand' | 'blue' | 'pink' | 'green';
export const toneColor: Record<Tone, string> = { brand: color.brand, blue: color.blue, pink: color.pink, green: color.green };
