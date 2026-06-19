import { useState, useEffect, useRef } from 'react'
import { getMenuAdmin, createMenuItem, updateMenuItem, toggleAvailability, deleteMenuItem } from '../../api/menu.api'
import { Button } from '../../components/Button'
import { Spinner } from '../../components/Spinner'

const CATEGORIES = ['Starters', 'Mains', 'Breads', 'Drinks', 'Desserts']

// ── Add / Edit Item Modal ──────────────────────────────────────────────────────
function ItemModal({ item, onSave, onClose }) {
  const [form, setForm] = useState({
    name:        item?.name        ?? '',
    description: item?.description ?? '',
    category:    item?.category    ?? 'Starters',
    price:       item?.price       ?? '',
    isVeg:       item?.isVeg       ?? true,
    available:   item?.available   ?? true,
    tags:        (item?.tags ?? []).join(', '),
    customizationOptions: item?.customizationOptions ?? [],
  })
  const [photoFile, setPhotoFile] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [error,  setError]        = useState('')
  const fileRef = useRef(null)

  const addCustomGroup = () =>
    setForm(f => ({
      ...f,
      customizationOptions: [
        ...f.customizationOptions,
        { groupName: '', type: 'single', required: false, choices: [''] },
      ],
    }))

  const removeCustomGroup = (i) =>
    setForm(f => ({
      ...f,
      customizationOptions: f.customizationOptions.filter((_, idx) => idx !== i),
    }))

  const updateGroup = (i, key, val) =>
    setForm(f => ({
      ...f,
      customizationOptions: f.customizationOptions.map((g, idx) =>
        idx === i ? { ...g, [key]: val } : g
      ),
    }))

  const addChoice = (i) =>
    setForm(f => ({
      ...f,
      customizationOptions: f.customizationOptions.map((g, idx) =>
        idx === i ? { ...g, choices: [...g.choices, ''] } : g
      ),
    }))

  const updateChoice = (gi, ci, val) =>
    setForm(f => ({
      ...f,
      customizationOptions: f.customizationOptions.map((g, idx) =>
        idx === gi
          ? { ...g, choices: g.choices.map((c, ci2) => ci2 === ci ? val : c) }
          : g
      ),
    }))

  const handleSubmit = async () => {
    if (!form.name || !form.price) { setError('Name and price are required'); return }
    setSaving(true); setError('')
    try {
      const fd = new FormData()
      fd.append('name',        form.name)
      fd.append('description', form.description)
      fd.append('category',    form.category)
      fd.append('price',       String(form.price))
      fd.append('isVeg',       String(form.isVeg))
      fd.append('available',   String(form.available))
      fd.append('tags',        form.tags)
      fd.append('customizationOptions', JSON.stringify(form.customizationOptions))
      if (photoFile) fd.append('photo', photoFile)

      const result = item
        ? await updateMenuItem(item._id, Object.fromEntries(fd.entries()))
        : await createMenuItem(fd)

      onSave(result.item)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6 px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        data-testid="item-modal"
        className="relative bg-bgCard border border-border rounded-2xl p-6 w-full max-w-lg"
      >
        <h3 className="font-semibold text-text text-lg mb-4">
          {item ? 'Edit Item' : 'Add Item'}
        </h3>

        <div className="space-y-3">
          {/* Photo */}
          <div>
            <p className="text-xs text-textMuted mb-1">Photo (optional)</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => setPhotoFile(e.target.files[0])}
              data-testid="photo-input"
            />
            <button
              onClick={() => fileRef.current.click()}
              className="w-full h-24 border-2 border-dashed border-border rounded-xl flex items-center justify-center text-textMuted hover:border-accent hover:text-accent transition-colors"
            >
              {photoFile ? `📷 ${photoFile.name}` : item?.photoUrl ? '🖼️ Change photo' : '📷 Upload photo'}
            </button>
          </div>

          {/* Name */}
          <input
            type="text"
            placeholder="Item name *"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            data-testid="name-input"
            className="w-full bg-bgElevated border border-border rounded-xl px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
          />

          {/* Description */}
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full bg-bgElevated border border-border rounded-xl px-3 py-2 text-text text-sm resize-none focus:outline-none focus:border-accent"
          />

          {/* Category + Price row */}
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              data-testid="category-select"
              className="bg-bgElevated border border-border rounded-xl px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="number"
              placeholder="Price (₹) *"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              data-testid="price-input"
              className="bg-bgElevated border border-border rounded-xl px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
            />
          </div>

          {/* Veg + Available */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-textMuted cursor-pointer">
              <input
                type="checkbox"
                checked={form.isVeg}
                onChange={e => setForm(f => ({ ...f, isVeg: e.target.checked }))}
                data-testid="isveg-checkbox"
                className="accent-green"
              />
              Vegetarian
            </label>
            <label className="flex items-center gap-2 text-sm text-textMuted cursor-pointer">
              <input
                type="checkbox"
                checked={form.available}
                onChange={e => setForm(f => ({ ...f, available: e.target.checked }))}
                className="accent-accent"
              />
              Available
            </label>
          </div>

          {/* Customization groups */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-textMuted">Customization Options</p>
              <button
                data-testid="add-custom-group"
                onClick={addCustomGroup}
                className="text-xs text-accent hover:underline"
              >
                + Add Group
              </button>
            </div>
            {form.customizationOptions.map((group, gi) => (
              <div key={gi} className="bg-bgElevated rounded-xl p-3 mb-2 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Group name (e.g. Spice Level)"
                    value={group.groupName}
                    onChange={e => updateGroup(gi, 'groupName', e.target.value)}
                    className="flex-1 bg-bgCard border border-border rounded-lg px-2 py-1.5 text-text text-xs focus:outline-none"
                  />
                  <select
                    value={group.type}
                    onChange={e => updateGroup(gi, 'type', e.target.value)}
                    className="bg-bgCard border border-border rounded-lg px-2 py-1.5 text-text text-xs focus:outline-none"
                  >
                    <option value="single">Single</option>
                    <option value="multi">Multi</option>
                  </select>
                  <button onClick={() => removeCustomGroup(gi)} className="text-red text-xs">✕</button>
                </div>
                {group.choices.map((choice, ci) => (
                  <input
                    key={ci}
                    type="text"
                    placeholder={`Choice ${ci + 1}`}
                    value={choice}
                    onChange={e => updateChoice(gi, ci, e.target.value)}
                    className="w-full bg-bgCard border border-border rounded-lg px-2 py-1.5 text-text text-xs focus:outline-none"
                  />
                ))}
                <button onClick={() => addChoice(gi)} className="text-xs text-textMuted hover:text-text">+ Add choice</button>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-red text-xs mt-2" data-testid="modal-error">{error}</p>}

        <div className="flex gap-3 mt-4">
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button fullWidth disabled={saving} onClick={handleSubmit} data-testid="save-item-btn">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Item Card ──────────────────────────────────────────────────────────────────
function ItemCard({ item, onToggle, onEdit, onDelete }) {
  const vpsPublicUrl = import.meta.env.VITE_VPS_PUBLIC_URL ?? ''

  return (
    <div
      data-testid={`item-card-${item._id}`}
      className={`bg-bgCard border rounded-xl overflow-hidden transition-opacity ${item.available ? 'border-border' : 'border-border opacity-60'}`}
    >
      {item.photoUrl ? (
        <img src={item.photoUrl} alt={item.name} className="w-full h-28 object-cover" />
      ) : (
        <div className="w-full h-28 bg-bgElevated flex items-center justify-center text-3xl">🍽️</div>
      )}
      <div className="p-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-text text-sm font-semibold">{item.name}</p>
            <p className="text-accent text-sm font-bold mt-0.5">₹{item.price}</p>
          </div>
          <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${item.isVeg ? 'bg-green' : 'bg-red'}`} />
        </div>
        <p className="text-textMuted text-xs mt-1">{item.category}</p>
        <div className="flex items-center gap-1 mt-2">
          <button
            data-testid={`toggle-${item._id}`}
            onClick={() => onToggle(item._id, !item.available)}
            className={`flex-1 text-xs py-1 rounded-lg border transition-colors ${
              item.available
                ? 'border-green/30 text-green hover:bg-red/10 hover:text-red hover:border-red/30'
                : 'border-red/30 text-red hover:bg-green/10 hover:text-green hover:border-green/30'
            }`}
          >
            {item.available ? 'Available' : 'Unavailable'}
          </button>
          <button
            data-testid={`edit-${item._id}`}
            onClick={() => onEdit(item)}
            className="p-1.5 text-textMuted hover:text-text rounded-lg hover:bg-bgElevated"
          >
            ✏️
          </button>
          <button
            data-testid={`delete-${item._id}`}
            onClick={() => onDelete(item._id)}
            className="p-1.5 text-textMuted hover:text-red rounded-lg hover:bg-red/10"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main MenuManager ───────────────────────────────────────────────────────────
export default function MenuManager() {
  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('All')
  const [showAdd,  setShowAdd]  = useState(false)
  const [editItem, setEditItem] = useState(null)

  useEffect(() => {
    getMenuAdmin()
      .then(data => setItems(data.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (itemId, available) => {
    try {
      const data = await toggleAvailability(itemId, available)
      setItems(prev => prev.map(i => i._id === itemId ? data.item : i))
    } catch {}
  }

  const handleDelete = async (itemId) => {
    try {
      await deleteMenuItem(itemId)
      setItems(prev => prev.filter(i => i._id !== itemId))
    } catch {}
  }

  const handleSaved = (item) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i._id === item._id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = item
        return next
      }
      return [...prev, item]
    })
    setShowAdd(false)
    setEditItem(null)
  }

  const categories   = ['All', ...new Set(items.map(i => i.category))]
  const visibleItems = filter === 'All' ? items : items.filter(i => i.category === filter)

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Spinner size="xl" /></div>
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-xl text-text">Menu Manager</h2>
        <Button data-testid="add-item-btn" size="sm" onClick={() => setShowAdd(true)}>
          + Add Item
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto mb-4" style={{ scrollbarWidth: 'none' }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={[
              'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              filter === cat
                ? 'bg-accent text-bg'
                : 'bg-bgElevated text-textMuted border border-border hover:text-text',
            ].join(' ')}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {visibleItems.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-textMuted">No items. Add your first menu item!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {visibleItems.map(item => (
            <ItemCard
              key={item._id}
              item={item}
              onToggle={handleToggle}
              onEdit={setEditItem}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <ItemModal onSave={handleSaved} onClose={() => setShowAdd(false)} />
      )}
      {editItem && (
        <ItemModal item={editItem} onSave={handleSaved} onClose={() => setEditItem(null)} />
      )}
    </div>
  )
}
