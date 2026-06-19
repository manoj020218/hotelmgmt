import React from 'react'

const colorMap = {
  green:   'bg-green/15  text-green  border-green/20',
  red:     'bg-red/15    text-red    border-red/20',
  yellow:  'bg-yellow/15 text-yellow border-yellow/20',
  blue:    'bg-blue/15   text-blue   border-blue/20',
  purple:  'bg-purple/15 text-purple border-purple/20',
  accent:  'bg-accent/15 text-accent border-accent/20',
  muted:   'bg-bgElevated text-textMuted border-border',
}

const sizeMap = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2   py-0.5 text-xs',
  md: 'px-2.5 py-1   text-xs',
}

export function Badge({ children, color = 'muted', size = 'sm', className = '' }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border font-medium',
        colorMap[color] ?? colorMap.muted,
        sizeMap[size]  ?? sizeMap.sm,
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}

export function OrderStatusBadge({ status }) {
  const map = {
    pending:   { color: 'yellow',  label: 'Pending'   },
    assigned:  { color: 'blue',    label: 'Assigned'  },
    preparing: { color: 'purple',  label: 'Preparing' },
    ready:     { color: 'accent',  label: 'Ready'     },
    served:    { color: 'green',   label: 'Served'    },
    rejected:  { color: 'red',     label: 'Rejected'  },
    cancelled: { color: 'muted',   label: 'Cancelled' },
  }
  const { color, label } = map[status] ?? { color: 'muted', label: status }
  return <Badge color={color}>{label}</Badge>
}
