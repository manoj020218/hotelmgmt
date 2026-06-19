import { useState, useEffect } from 'react'
import { getAdminFeedback } from '../../api/feedback.api'
import { Spinner } from '../../components/Spinner'

function Stars({ value }) {
  return (
    <span className="text-accent text-sm">
      {'★'.repeat(Math.round(value || 0))}{'☆'.repeat(5 - Math.round(value || 0))}
    </span>
  )
}

export default function Feedback() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [waiterFilter, setWaiterFilter] = useState('')

  useEffect(() => {
    getAdminFeedback(waiterFilter ? { waiterId: waiterFilter } : {})
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [waiterFilter])

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Spinner size="xl" /></div>
  }

  const { feedbacks = [], avgRatings = {}, waiterLeaderboard = [] } = data ?? {}

  return (
    <div className="p-4 space-y-4">
      <h2 className="font-display font-bold text-xl text-text">Feedback</h2>

      {/* Average ratings */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Waiter',  key: 'waiter'  },
          { label: 'Food',    key: 'food'    },
          { label: 'Overall', key: 'overall' },
        ].map(r => (
          <div key={r.key} data-testid={`avg-${r.key}`}
            className="bg-bgCard border border-border rounded-xl p-4 text-center"
          >
            <Stars value={avgRatings[r.key] ?? 0} />
            <p className="font-bold text-text text-lg mt-1">
              {avgRatings[r.key]?.toFixed(1) ?? '—'}
            </p>
            <p className="text-textMuted text-xs">{r.label}</p>
          </div>
        ))}
      </div>

      {/* Waiter leaderboard */}
      {waiterLeaderboard.length > 0 && (
        <div className="bg-bgCard border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text">Waiter Leaderboard</h3>
          </div>
          <div className="divide-y divide-border">
            {waiterLeaderboard.map((w, i) => (
              <div
                key={w._id}
                data-testid={`leaderboard-${w._id}`}
                className="px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-textDim text-sm w-6">#{i + 1}</span>
                  <p className="text-text text-sm font-medium">{w.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Stars value={w.avgRating} />
                  <span className="text-textMuted text-xs">({w.ratingCount})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Individual feedbacks */}
      <div className="space-y-3">
        {feedbacks.map(fb => (
          <div key={fb._id} className="bg-bgCard border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex gap-3 text-xs text-textMuted">
                <span>Waiter: <Stars value={fb.ratings?.waiter} /></span>
                <span>Food: <Stars value={fb.ratings?.food} /></span>
                <span>Overall: <Stars value={fb.ratings?.overall} /></span>
              </div>
              <span className="text-xs text-textDim">
                {new Date(fb.submittedAt).toLocaleDateString()}
              </span>
            </div>
            {fb.comment && <p className="text-text text-sm">{fb.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
