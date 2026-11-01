import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'vn.artverseai.app',
  appName: 'ARTVERSE AI',
  webDir: 'dist',
  backgroundColor: '#FAF8F5',
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    scrollEnabled: true,
    backgroundColor: '#FAF8F5',
    preferredContentMode: 'mobile',
    scheme: 'ARTVERSE AI',
  },
  server: {
    iosScheme: 'capacitor',
    androidScheme: 'https',
    allowNavigation: [
      '*.firebaseapp.com',
      '*.googleapis.com',
      '*.google.com',
      '*.gstatic.com',
    ],
  },
};

export default config;
