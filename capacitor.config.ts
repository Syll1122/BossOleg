import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bossOleg.watchapp',
  appName: 'Watch App',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
