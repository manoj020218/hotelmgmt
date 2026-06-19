import React from 'react'

export function Card({ children, className = '', onClick, elevated = false }) {
  const base = elevated ? 'bg-bgElevated' : 'bg-bgCard'
  return (
    <div
      onClick={onClick}
      className={[
        base,
        'rounded-xl border border-border',
        onClick ? 'cursor-pointer hover:border-accent/30 transition-colors duration-150' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`px-4 py-3 border-b border-border ${className}`}>
      {children}
    </div>
  )
}

export function CardBody({ children, className = '' }) {
  return (
    <div className={`p-4 ${className}`}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`px-4 py-3 border-t border-border ${className}`}>
      {children}
    </div>
  )
}
