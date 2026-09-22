import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zui.iptv.mobile',
  appName: 'ZUI IPTV Mobile',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      androidScaleType: "CENTER_CROP",
      backgroundColor: "#08080c",
      showSpinner: false,
    },
    CapacitorHttp: { enabled: true },
  },
  android: { allowMixedContent: true },
};

export default config;
