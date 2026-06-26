import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId:   'com.hotelqr.waiter',
  appName: 'Hotel Waiter',
  webDir:  'dist',
  android: {
    path: 'android-waiter',
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
