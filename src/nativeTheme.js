import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeTheme = registerPlugin('NativeTheme');

export const applyNativeTheme = (theme) => {
  if (!Capacitor.isNativePlatform()) {
    return Promise.resolve();
  }

  return NativeTheme.setTheme({ theme });
};
