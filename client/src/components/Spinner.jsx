import React from 'react'

export function Spinner({ size = 'md', color = 'accent', className = '' }) {
  const sz = { xs: 'w-3 h-3', sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8', xl: 'w-12 h-12' }[size] ?? 'w-6 h-6'
  const cl = { accent: 'text-accent', white: 'text-white', muted: 'text-textMuted' }[color] ?? 'text-accent'
  return (
    <svg
      className={`animate-spin ${sz} ${cl} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export function PageLoader({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg gap-4">
      <Spinner size="xl" />
      <p className="text-textMuted text-sm">{message}</p>
    </div>
  )
}

export function InlineLoader({ message }) {
  return (
    <div className="flex items-center gap-2 py-6 justify-center">
      <Spinner size="sm" />
      {message && <span className="text-sm text-textMuted">{message}</span>}
    </div>
  )
}
