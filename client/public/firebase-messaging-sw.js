importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js')

// Config injected at build time via vite-plugin-pwa injectManifest or hard-coded
// for now. Replace with real values at deploy time.
firebase.initializeApp({
  apiKey:            'AIzaSyAcCDBEaZPcqHTodcSb1N2OemF_kchLn7c',
  authDomain:        'hotelqr-8be21.firebaseapp.com',
  projectId:         'hotelqr-8be21',
  messagingSenderId: '803577992717',
  appId:             '1:803577992717:web:2bc7562cb49118d6ad2744',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {}
  self.registration.showNotification(title ?? 'Hotel QR', {
    body:  body ?? '',
    icon:  '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    data:  payload.data,
  })
})
