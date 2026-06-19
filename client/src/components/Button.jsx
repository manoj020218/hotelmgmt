import React from 'react'

const variantClass = {
  primary:   'bg-accent text-bg font-semibold hover:brightness-110',
  secondary: 'bg-bgElevated text-text border border-border hover:bg-bgCard',
  danger:    'bg-red text-white font-semibold hover:brightness-110',
  ghost:     'text-textMuted hover:text-text bg-transparent',
  outline:   'border border-accent text-accent hover:bg-accent hover:text-bg',
}

const sizeClass = {
  xs: 'px-2.5 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export function Button({
  children,
  variant   = 'primary',
  size      = 'md',
  onClick,
  disabled  = false,
  type      = 'button',
  className = '',
  loading   = false,
  fullWidth = false,
  ...rest
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={[
        'rounded-lg transition-all duration-150 active:scale-95',
        'inline-flex items-center justify-center gap-2',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        variantClass[variant] ?? variantClass.primary,
        sizeClass[size] ?? sizeClass.md,
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
