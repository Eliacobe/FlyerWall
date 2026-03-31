function EventDetail({ event, onClose, onTagClick }) {
  const dateStr = event.starts_at
    ? new Date(event.starts_at).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : null;

  const timeStr = event.starts_at
    ? new Date(event.starts_at).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      })
    : null;

  return (
    <div className="event-detail">
      <div className="detail-image-panel">
        <img src={event.image_url} alt={event.title} className="detail-image" />
      </div>

      <div className="detail-info-panel">
        <button onClick={onClose} className="detail-back">← Back</button>

        <h2 className="detail-title">{event.title || 'Untitled Event'}</h2>

        {event.description && (
          <p className="detail-description">{event.description}</p>
        )}

        <div className="detail-meta">
          {dateStr && (
            <div className="detail-meta-row">
              <span className="detail-meta-label">Date</span>
              <span>{dateStr}{timeStr ? ` · ${timeStr}` : ''}</span>
            </div>
          )}
          {event.venue && (
            <div className="detail-meta-row">
              <span className="detail-meta-label">Venue</span>
              <span>{event.venue}</span>
            </div>
          )}
          {event.price && (
            <div className="detail-meta-row">
              <span className="detail-meta-label">Price</span>
              <span>{event.price}</span>
            </div>
          )}
          {event.organiser && (
            <div className="detail-meta-row">
              <span className="detail-meta-label">Organiser</span>
              <span>{event.organiser}</span>
            </div>
          )}
        </div>

        {Array.isArray(event.tags) && event.tags.length > 0 && (
          <div className="tag-list" style={{ marginTop: '1.5rem' }}>
            {event.tags.map((tag) => (
              <button
                key={tag}
                className="tag tag-clickable"
                onClick={() => onTagClick?.(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default EventDetail;
