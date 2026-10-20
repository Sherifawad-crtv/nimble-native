import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { T } from './Text';
import { color, font, radius } from './theme';

interface Props extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export function TextField({ label, error, hint, required, multiline, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {label ? (
        <T variant="label" tone="muted">
          {label}
          {required ? <T variant="label" tone="brand"> *</T> : null}
        </T>
      ) : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={color.faint}
        selectionColor={color.brand}
        cursorColor={color.brand}
        multiline={multiline}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[styles.input, multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 14 }, { borderColor: error ? color.danger : focused ? color.brand : color.fieldEdge }]}
      />
      {error ? (
        <T variant="caption" tone="danger">
          {error}
        </T>
      ) : hint ? (
        <T variant="caption" tone="muted">
          {hint}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: { minHeight: 52, borderRadius: radius.pill > 30 ? 26 : 26, borderWidth: 1, backgroundColor: color.fieldBg, color: color.ink, paddingHorizontal: 20, fontFamily: font.sansMedium, fontSize: 17 },
});
