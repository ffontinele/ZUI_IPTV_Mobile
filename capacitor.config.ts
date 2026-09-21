import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zui.iptv.mobile',
  appName: 'ZUI IPTV Mobile',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: { enabled: true },
  },
  android: { allowMixedContent: true },
};

export default config;
