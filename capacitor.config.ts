import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.8be9308aa277437592cdc04cdec59763',
  appName: 'Calorie Tracker AI',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    },
    SpeechRecognition: {
      permissions: {
        microphone: 'Для распознавания голосовых команд'
      }
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
