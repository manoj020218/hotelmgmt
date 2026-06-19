import React from 'react'

export function Toggle({ checked, onChange, disabled = false, label, description }) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => !disabled && onChange(e.target.checked)}
          className="sr-only"
          disabled={disabled}
        />
        <div
          onClick={() => !disabled && onChange(!checked)}
          className={[
            'w-10 h-6 rounded-full transition-colors duration-200',
            checked ? 'bg-accent' : 'bg-bgElevated border border-border',
          ].join(' ')}
        >
          <div
            className={[
              'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
              checked ? 'translate-x-5' : 'translate-x-1',
            ].join(' ')}
          />
        </div>
      </div>
      {(label || description) && (
        <div>
          {label       && <p className="text-sm font-medium text-text">{label}</p>}
          {description && <p className="text-xs text-textMuted mt-0.5">{description}</p>}
        </div>
      )}
    </label>
  )
}
