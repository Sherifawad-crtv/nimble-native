import { Text as RNText, type TextProps } from 'react-native';
import { color, type Variant, type } from './theme';

interface Props extends TextProps {
  variant?: Variant;
  tone?: 'ink' | 'muted' | 'brand' | 'danger' | 'onBrand';
}

const tones = { ink: color.ink, muted: color.muted, brand: color.brand, danger: color.danger, onBrand: color.onBrand };

/** All text goes through here so type styles stay in one place. Scales with the phone's text size, capped. */
export function T({ variant = 'body', tone = 'ink', style, ...rest }: Props) {
  return <RNText maxFontSizeMultiplier={1.4} {...rest} style={[type[variant], { color: tones[tone] }, style]} />;
}
