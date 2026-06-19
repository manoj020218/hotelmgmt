import React, { forwardRef } from 'react'

export const Input = forwardRef(function Input(
  { label, error, hint, prefix, suffix, className = '', ...props },
  ref
) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-textMuted">
          {label}
          {props.required && <span className="text-red ml-1">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-textDim text-sm">{prefix}</span>
        )}
        <input
          ref={ref}
          className={[
            'w-full bg-bgElevated border rounded-lg px-3 py-2 text-sm text-text',
            'placeholder:text-textDim outline-none',
            'focus:border-accent/60 focus:ring-1 focus:ring-accent/30',
            'transition-all duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error  ? 'border-red'    : 'border-border',
            prefix ? 'pl-8'          : '',
            suffix ? 'pr-8'          : '',
          ].join(' ')}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-textDim text-sm">{suffix}</span>
        )}
      </div>
      {error && <p className="text-xs text-red">{error}</p>}
      {hint && !error && <p className="text-xs text-textMuted">{hint}</p>}
    </div>
  )
})

export const Textarea = forwardRef(function Textarea(
  { label, error, hint, className = '', ...props },
  ref
) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-textMuted">{label}</label>
      )}
      <textarea
        ref={ref}
        className={[
          'w-full bg-bgElevated border rounded-lg px-3 py-2 text-sm text-text',
          'placeholder:text-textDim outline-none resize-none',
          'focus:border-accent/60 focus:ring-1 focus:ring-accent/30',
          'transition-all duration-150',
          error ? 'border-red' : 'border-border',
        ].join(' ')}
        {...props}
      />
      {error && <p className="text-xs text-red">{error}</p>}
      {hint && !error && <p className="text-xs text-textMuted">{hint}</p>}
    </div>
  )
})

export function Select({ label, error, hint, children, className = '', ...props }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-textMuted">{label}</label>
      )}
      <select
        className={[
          'w-full bg-bgElevated border rounded-lg px-3 py-2 text-sm text-text',
          'outline-none cursor-pointer',
          'focus:border-accent/60 focus:ring-1 focus:ring-accent/30',
          'transition-all duration-150',
          error ? 'border-red' : 'border-border',
        ].join(' ')}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red">{error}</p>}
      {hint && !error && <p className="text-xs text-textMuted">{hint}</p>}
    </div>
  )
}
