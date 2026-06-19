import { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { submitFeedback } from '../../api/feedback.api'
import { Button } from '../../components/Button'

function StarRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-textMuted text-sm w-20">{label}</span>
      <div className="flex gap-2" role="group" aria-label={`${label} rating`}>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            aria-label={`${label} ${star} star`}
            onClick={() => onChange(star)}
            className={`text-2xl transition-transform ${
              star <= value ? 'text-accent scale-110' : 'text-textDim'
            }`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  )
}

export default function FeedbackPage() {
  const { orderId } = useParams()
  const navigate    = useNavigate()
  const location    = useLocation()
  const sessionId   = location.state?.sessionId
    ?? JSON.parse(sessionStorage.getItem('lastOrder') ?? '{}').sessionId

  const [ratings, setRatings]   = useState({ waiter: 0, food: 0, overall: 0 })
  const [comment, setComment]   = useState('')
  const [submitting, setSub]    = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)

  const setRating = (key, val) => setRatings(r => ({ ...r, [key]: val }))

  const handleSubmit = async () => {
    if (ratings.overall === 0) {
      setError('Please rate your overall experience')
      return
    }
    setSub(true)
    setError('')
    try {
      await submitFeedback({ orderId, sessionId, ratings, comment })
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Could not submit feedback')
    } finally {
      setSub(false)
    }
  }

  if (done) {
    return (
      <div data-testid="thank-you" className="flex flex-col items-center justify-center min-h-screen bg-bg gap-6 px-4">
        <div className="text-6xl">🙏</div>
        <h1 className="font-display font-bold text-2xl text-text text-center">Thank you!</h1>
        <p className="text-textMuted text-sm text-center">Your feedback helps us serve you better</p>
        <Button onClick={() => navigate('/menu')} fullWidth>Back to Menu</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg pb-8">
      <div className="sticky top-0 z-10 bg-bg/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="font-display font-bold text-xl text-text">How was your experience?</h1>
        <button
          data-testid="skip-btn"
          onClick={() => navigate('/menu')}
          className="text-textMuted text-sm"
        >
          Skip
        </button>
      </div>

      <div className="mx-4 mt-6 bg-bgCard border border-border rounded-xl p-4 space-y-5">
        <StarRow label="Waiter"  value={ratings.waiter}  onChange={v => setRating('waiter', v)} />
        <StarRow label="Food"    value={ratings.food}    onChange={v => setRating('food', v)} />
        <StarRow label="Overall" value={ratings.overall} onChange={v => setRating('overall', v)} />
      </div>

      <div className="mx-4 mt-4">
        <textarea
          data-testid="comment-input"
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Any comments? (optional)"
          rows={3}
          className="w-full bg-bgCard border border-border rounded-xl px-4 py-3 text-text text-sm placeholder:text-textDim resize-none focus:outline-none focus:border-accent"
        />
      </div>

      {error && (
        <p data-testid="feedback-error" className="mx-4 mt-2 text-red text-sm">{error}</p>
      )}

      <div className="mx-4 mt-4">
        <Button
          data-testid="submit-btn"
          fullWidth
          size="lg"
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting ? 'Submitting…' : 'Submit Feedback'}
        </Button>
      </div>
    </div>
  )
}
