import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId:   'com.hotelqr.kds',
  appName: 'Hotel KDS',
  webDir:  'dist',
  android: {
    path: 'android-kds',
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
