import { useState, useEffect } from 'react'

let _deferredPrompt = null

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    _deferredPrompt = e
  })
}

export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false)
  const [installed,  setInstalled]  = useState(false)

  useEffect(() => {
    const check = () => setCanInstall(!!_deferredPrompt)
    check()

    const onInstalled = () => {
      _deferredPrompt = null
      setInstalled(true)
      setCanInstall(false)
    }
    window.addEventListener('appinstalled', onInstalled)
    return () => window.removeEventListener('appinstalled', onInstalled)
  }, [])

  const promptInstall = async () => {
    if (!_deferredPrompt) return false
    _deferredPrompt.prompt()
    const { outcome } = await _deferredPrompt.userChoice
    _deferredPrompt = null
    setCanInstall(false)
    if (outcome === 'accepted') setInstalled(true)
    return outcome === 'accepted'
  }

  return { canInstall, installed, promptInstall }
}
