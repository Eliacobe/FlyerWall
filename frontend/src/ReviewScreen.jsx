import { useState } from 'react';
import { updateEvent } from './api';

function ReviewScreen({ event, extractionError, onSave, onDiscard, discardLabel = 'Discard' }) {
  const [form, setForm] = useState({
    title: event.title || '',
    description: event.description || '',
    venue: event.venue || '',
    starts_at: event.starts_at
      ? new Date(event.starts_at).toISOString().slice(0, 16)
      : '',
    price: event.price || '',
    organiser: event.organiser || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      const data = { ...form, starts_at: form.starts_at || null };
      await updateEvent(event.id, data);
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="review-screen">
      <div className="review-image-panel">
        <img src={event.image_url} alt="Uploaded flyer" className="review-image" />
      </div>

      <div className="review-form-panel">
        <h2>Review Extracted Info</h2>

        {extractionError && (
          <p className="review-warning">
            Extraction error: {extractionError}
          </p>
        )}
        {!extractionError && event.needs_review && (
          <p className="review-warning">
            Extraction may be incomplete — please review the fields below.
          </p>
        )}

        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="Event title"
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            placeholder="Short description"
          />
        </div>

        <div className="form-group">
          <label htmlFor="venue">Venue</label>
          <input
            id="venue"
            name="venue"
            value={form.venue}
            onChange={handleChange}
            placeholder="Venue or location"
          />
        </div>

        <div className="form-group">
          <label htmlFor="starts_at">Date & Time</label>
          <input
            id="starts_at"
            type="datetime-local"
            name="starts_at"
            value={form.starts_at}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="price">Price</label>
          <input
            id="price"
            name="price"
            value={form.price}
            onChange={handleChange}
            placeholder="e.g. Free, £10"
          />
        </div>

        <div className="form-group">
          <label htmlFor="organiser">Organiser</label>
          <input
            id="organiser"
            name="organiser"
            value={form.organiser}
            onChange={handleChange}
            placeholder="Organiser or promoter"
          />
        </div>

        {Array.isArray(event.tags) && event.tags.length > 0 && (
          <div className="form-group">
            <label>Tags</label>
            <div className="tag-list">
              {event.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {error && <p className="review-error">{error}</p>}

        <div className="review-actions">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Confirm & Save'}
          </button>
          <button onClick={onDiscard} disabled={saving} className="btn-secondary">
            {discardLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReviewScreen;
