import { useEffect, useRef } from 'react'
import { useAuthStore } from '../stores/authStore'
import api from '../api/axios'

let _messaging = null

async function getMessaging() {
  if (_messaging) return _messaging
  try {
    const { initializeApp, getApps } = await import('firebase/app')
    const { getMessaging: fbGetMessaging } = await import('firebase/messaging')

    const firebaseConfig = {
      apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId:             import.meta.env.VITE_FIREBASE_APP_ID,
    }

    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
    _messaging = fbGetMessaging(app)
  } catch {
    return null
  }
  return _messaging
}

export function useFCM({ enabled = false } = {}) {
  const user        = useAuthStore(s => s.user)
  const registeredRef = useRef(false)

  useEffect(() => {
    if (!enabled || !user || registeredRef.current) return

    ;(async () => {
      try {
        const messaging = await getMessaging()
        if (!messaging) return

        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        const { getToken } = await import('firebase/messaging')
        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
        const token = await getToken(messaging, { vapidKey })
        if (!token) return

        await api.post('/auth/fcm-token', { fcmToken: token })
        registeredRef.current = true
      } catch {
        // FCM unavailable — silently ignore (not critical)
      }
    })()
  }, [enabled, user])
}

export function useFCMForeground(onMessage) {
  useEffect(() => {
    let unsub = null
    ;(async () => {
      try {
        const messaging = await getMessaging()
        if (!messaging) return
        const { onMessage: fbOnMessage } = await import('firebase/messaging')
        unsub = fbOnMessage(messaging, onMessage)
      } catch {
        // ignore
      }
    })()
    return () => { if (unsub) unsub() }
  }, [onMessage])
}
