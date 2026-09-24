import { registerPlugin } from '@capacitor/core';
export const NativePlayer = registerPlugin<any>('NativePlayer');
export function nativePlayerFlag(): boolean {
  try { return localStorage.getItem('zui-native-player') === '1'; } catch { return false; }
}
