import { forwardRef } from 'react';
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';

export const Text = forwardRef<NativeText, TextProps>(function AppText(props, ref) {
  return <NativeText {...props} ref={ref} allowFontScaling maxFontSizeMultiplier={props.maxFontSizeMultiplier ?? 2} />;
});

export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function AppTextInput(props, ref) {
  return <NativeTextInput {...props} ref={ref} allowFontScaling maxFontSizeMultiplier={props.maxFontSizeMultiplier ?? 2} />;
});
