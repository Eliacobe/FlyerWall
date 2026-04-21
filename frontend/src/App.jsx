import { useState, useEffect, useRef } from 'react';
import { getEvents, uploadFlyer, deleteEvent, searchEvents, getMyEvents } from './api';
import ReviewScreen from './ReviewScreen';
import EventDetail from './EventDetail';
import LoginModal from './LoginModal';
import CalendarPicker from './CalendarPicker';
import './App.css';

function seededRand(seed, salt) {
  const x = Math.sin(seed * 9301 + salt * 49297 + 1) * 233280;
  return x - Math.floor(x);
}

function idToSeed(id) {
  return String(id).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

function cardStyle(id, zIndex, index, total) {
  const seed = idToSeed(id);
  const base = (index / Math.max(total - 1, 1)) * 45;
  const jitter = (seededRand(seed, 0) - 0.5) * 12;
  const top  = Math.max(1, base + jitter + 3);
  const left = seededRand(seed, 1) * 62 + 2;
  const rot  = (seededRand(seed, 2) - 0.5) * 14;
  return {
    '--card-top':    `${top}%`,
    '--card-left':   `${left}%`,
    '--card-rotate': `${rot}deg`,
    zIndex,
  };
}

function App() {
  const [events, setEvents] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [activeTag, setActiveTag] = useState(null);
  const [tagSidebarOpen, setTagSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pendingEvent, setPendingEvent] = useState(null);
  const [extractionError, setExtractionError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [username, setUsername] = useState(() => localStorage.getItem('username'));
  const [showLogin, setShowLogin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInterpretation, setSearchInterpretation] = useState(null);
  const [searching, setSearching] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [myFlyers, setMyFlyers] = useState(null); 
  const [myFlyersLoading, setMyFlyersLoading] = useState(false);
  const [sorted, setSorted] = useState(false);
  const [dragPositions, setDragPositions] = useState({});
  const [draggingId, setDraggingId] = useState(null);
  const draggingRef = useRef(null);
  const boardRef = useRef(null);
  const didDragRef = useRef(false);

  useEffect(() => {
    fetchEvents(null);
  }, []);

  useEffect(() => {
    function onMove(e) {
      if (!draggingRef.current) return;
      const { id, startMouseX, startMouseY, startTop, startLeft, boardWidth, boardHeight } = draggingRef.current;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      if (Math.abs(clientX - startMouseX) > 4 || Math.abs(clientY - startMouseY) > 4) {
        didDragRef.current = true;
      }
      const dx = ((clientX - startMouseX) / boardWidth) * 100;
      const dy = ((clientY - startMouseY) / boardHeight) * 100;
      setDragPositions(prev => ({ ...prev, [id]: { top: startTop + dy, left: startLeft + dx } }));
      if (e.touches) e.preventDefault();
    }
    function onUp() {
      draggingRef.current = null;
      setDraggingId(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  function handleCardPointerDown(e, eventId) {
    const isTouch = e.touches != null;
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;
    const board = boardRef.current;
    const card = e.currentTarget;
    const boardRect = board.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const boardHeight = board.offsetHeight;
    const boardWidth = board.offsetWidth;
    const currentTop = ((cardRect.top - boardRect.top) / boardHeight) * 100;
    const currentLeft = ((cardRect.left - boardRect.left) / boardWidth) * 100;
    draggingRef.current = { id: eventId, startMouseX: clientX, startMouseY: clientY, startTop: currentTop, startLeft: currentLeft, boardWidth, boardHeight };
    didDragRef.current = false;
    setDraggingId(eventId);
  }

  async function fetchEvents(tag) {
    try {
      setLoading(true);
      const data = await getEvents(tag ? { tag } : {});
      setEvents(data.data || []);
      if (!tag) {
        const tags = [...new Set(
          (data.data || []).flatMap(e => Array.isArray(e.tags) ? e.tags : [])
        )].sort();
        setAllTags(tags);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleTagClick(tag) {
    const next = tag === activeTag ? null : tag;
    setActiveTag(next);
    setSearchInterpretation(null);
    setSearchQuery('');
    fetchEvents(next);
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      setSearching(true);
      setActiveTag(null);
      const result = await searchEvents(searchQuery.trim());
      setEvents(result.data || []);
      setSearchInterpretation(result.interpretation || null);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  }

  function handleSearchClear() {
    setSearchQuery('');
    setSearchInterpretation(null);
    setSelectedDate(null);
    setActiveTag(null);
    fetchEvents(null);
  }

  async function handleDateSelect(dateKey) {
    setSelectedDate(dateKey);
    setSearchInterpretation(null);
    setSearchQuery('');
    setActiveTag(null);
    try {
      setLoading(true);
      const data = await getEvents({ date: dateKey });
      setEvents(data.data || []);
    } catch (err) {
      console.error('Date filter failed:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleDateClear() {
    setSelectedDate(null);
    fetchEvents(null);
  }

  async function openMyFlyers() {
    try {
      setMyFlyersLoading(true);
      setMyFlyers([]);
      const data = await getMyEvents(token);
      setMyFlyers(data.data || []);
    } catch (err) {
      console.error('Failed to load your flyers:', err);
    } finally {
      setMyFlyersLoading(false);
    }
  }

  function closeMyFlyers() {
    setMyFlyers(null);
  }

  async function handleDeleteMyFlyer(id) {
    if (!confirm('Remove this flyer?')) return;
    try {
      await deleteEvent(id, token);
      setMyFlyers(prev => prev.filter(e => e.id !== id));
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  function handleAuth(newToken, newUsername) {
    setToken(newToken);
    setUsername(newUsername);
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    setShowLogin(false);
  }

  function handleLogout() {
    setToken(null);
    setUsername(null);
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!token) {
      setShowLogin(true);
      e.target.value = '';
      return;
    }

    try {
      setUploading(true);
      const result = await uploadFlyer(file, token);
      setPendingEvent(result.event);
      setExtractionError(result.extractionError || null);
      e.target.value = '';
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleReviewSave() {
    setPendingEvent(null);
    setExtractionError(null);
    await fetchEvents(null);
    setActiveTag(null);
  }

  async function handleReviewDiscard() {
    if (pendingEvent) {
      try {
        await deleteEvent(pendingEvent.id, token);
      } catch (err) {
        console.error('Failed to delete discarded event:', err);
      }
    }
    setPendingEvent(null);
    setExtractionError(null);
  }

  if (selectedEvent) {
    return (
      <div className="app">
        <header>
          <h1>FlyerWall</h1>
        </header>
        <main>
          <EventDetail
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onTagClick={(tag) => {
              setSelectedEvent(null);
              handleTagClick(tag);
            }}
          />
        </main>
      </div>
    );
  }

  if (pendingEvent) {
    return (
      <div className="app">
        <header>
          <h1>FlyerWall</h1>
        </header>
        <main>
          <ReviewScreen
            event={pendingEvent}
            extractionError={extractionError}
            onSave={handleReviewSave}
            onDiscard={handleReviewDiscard}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>FlyerWall</h1>
        <div className="upload-section">
          <label htmlFor="file-upload" className="upload-button">
            {uploading ? 'Uploading...' : '+ Pin Flyer'}
          </label>
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            onChange={handleUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </div>
        <form className="search-form" onSubmit={handleSearch}>
          <input
            className="search-input"
            type="text"
            placeholder="e.g. comedy shows on the 19th..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="search-button" disabled={searching}>
            {searching ? '...' : 'Search'}
          </button>
          {searchInterpretation && (
            <button type="button" className="search-clear" onClick={handleSearchClear}>✕</button>
          )}
        </form>
        <CalendarPicker
          selectedDate={selectedDate}
          onSelect={handleDateSelect}
          onClear={handleDateClear}
        />
        <div className="auth-section">
          <button className={`auth-button sort-button${sorted ? ' active' : ''}`} onClick={() => setSorted(s => !s)}>
            {sorted ? 'Unsort' : 'Sort'}
          </button>
          {username ? (
            <>
              <span className="auth-username">{username}</span>
              <button className="auth-button" onClick={openMyFlyers}>My Flyers</button>
              <button className="auth-button" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <button className="auth-button" onClick={() => setShowLogin(true)}>Log in</button>
          )}
        </div>
      </header>

      {showLogin && (
        <LoginModal onAuth={handleAuth} onClose={() => setShowLogin(false)} />
      )}

      {allTags.length > 0 && (
        <aside className={`tag-sidebar${tagSidebarOpen ? ' open' : ''}`}>
          <button
            className="tag-sidebar-toggle"
            onClick={() => setTagSidebarOpen(o => !o)}
            title={tagSidebarOpen ? 'Hide filters' : 'Filter by tag'}
          >
            <span className="tag-sidebar-toggle-label">Filter</span>
          </button>
          <div className="tag-sidebar-content">
            {allTags.map((tag) => (
              <button
                key={tag}
                className={`tag-filter-chip${activeTag === tag ? ' active' : ''}`}
                onClick={() => handleTagClick(tag)}
              >
                {tag}
              </button>
            ))}
            {activeTag && (
              <button className="tag-filter-clear" onClick={() => handleTagClick(activeTag)}>
                ✕ Clear
              </button>
            )}
          </div>
        </aside>
      )}

      {myFlyers !== null && (
        <div className="my-flyers-overlay">
          <div className="my-flyers-panel">
            <div className="my-flyers-header">
              <h2>My Flyers</h2>
              <button className="my-flyers-close" onClick={closeMyFlyers}>✕</button>
            </div>
            {myFlyersLoading ? (
              <p className="my-flyers-empty">Loading...</p>
            ) : myFlyers.length === 0 ? (
              <p className="my-flyers-empty">You haven't pinned any flyers yet.</p>
            ) : (
              <div className="my-flyers-grid">
                {myFlyers.map(event => (
                  <div key={event.id} className="my-flyer-card">
                    <div
                      className="my-flyer-image"
                      style={{ backgroundImage: `url(${event.image_url})` }}
                    />
                    <div className="my-flyer-info">
                      <p className="my-flyer-title">{event.title || 'Untitled Event'}</p>
                      {event.starts_at && (
                        <p className="my-flyer-date">
                          {new Date(event.starts_at).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                        </p>
                      )}
                    </div>
                    <button
                      className="my-flyer-delete"
                      onClick={() => handleDeleteMyFlyer(event.id)}
                      title="Remove flyer"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <main>
        {searchInterpretation && (
          <p className="search-interpretation">
            Showing: <em>{searchInterpretation}</em>
            <button className="search-interpretation-clear" onClick={handleSearchClear}>Clear search</button>
          </p>
        )}
        {!loading && events.length > 0 && !searchInterpretation && !activeTag && !selectedDate && (
          <p className="board-tagline">Check out the events people have pinned — grab a flyer, spread the word.</p>
        )}
        {loading ? (
          <p>Loading events...</p>
        ) : events.length === 0 ? (
          <p>No events found{activeTag ? ` for "${activeTag}"` : searchInterpretation ? ' for your search' : ''}.</p>
        ) : sorted ? (
          <div className="sorted-grid">
            {events.map((event) => (
              <div
                key={event.id}
                className="event-card sorted-card"
                onClick={() => setSelectedEvent(event)}
              >
                <div
                  className="event-image"
                  style={{ backgroundImage: `url(${event.image_url})` }}
                />
                <div className="event-info">
                  <h3>{event.title || 'Untitled Event'}</h3>
                  {event.starts_at && (
                    <p className="event-date">
                      {new Date(event.starts_at).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                    </p>
                  )}
                  {event.venue && <p className="event-venue">{event.venue}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="poster-board" ref={boardRef}>
            {events.map((event, i) => {
              const pos = dragPositions[event.id];
              const isDragging = draggingId === event.id;
              const style = {
                ...cardStyle(event.id, i + 1, i, events.length),
                ...(pos ? { '--card-top': `${pos.top}%`, '--card-left': `${pos.left}%` } : {}),
                ...(isDragging ? { zIndex: 99999, transition: 'none', cursor: 'grabbing' } : {}),
              };
              return (
              <div
                key={event.id}
                className="event-card"
                style={style}
                onMouseDown={e => handleCardPointerDown(e, event.id)}
                onTouchStart={e => handleCardPointerDown(e, event.id)}
                onClick={() => { if (!didDragRef.current) setSelectedEvent(event); }}
              >
                <div
                  className="event-image"
                  style={{ backgroundImage: `url(${event.image_url})` }}
                />
                <div className="event-info">
                  <h3>{event.title || 'Untitled Event'}</h3>
                  {event.starts_at && (
                    <p className="event-date">
                      {new Date(event.starts_at).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                    </p>
                  )}
                  {event.venue && <p className="event-venue">{event.venue}</p>}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
