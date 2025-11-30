import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.8be9308aa277437592cdc04cdec59763',
  appName: 'A Lovable project',
  webDir: 'dist',
  server: {
    url: 'https://8be9308a-a277-4375-92cd-c04cdec59763.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;
