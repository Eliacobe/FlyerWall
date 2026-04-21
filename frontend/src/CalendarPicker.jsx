import { useState, useEffect, useRef } from 'react';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function toDateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function CalendarPicker({ selectedDate, onSelect, onClear }) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState({});
  const [viewYear, setViewYear] = useState(
    selectedDate ? parseInt(selectedDate.slice(0, 4)) : today.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(
    selectedDate ? parseInt(selectedDate.slice(5, 7)) - 1 : today.getMonth()
  );
  const [editingYear, setEditingYear] = useState(false);
  const [yearInput, setYearInput] = useState('');
  const triggerRef = useRef(null);
  const wrapperRef = useRef(null);

  function openPopup() {
    const rect = triggerRef.current.getBoundingClientRect();
    setPopupStyle({
      top: rect.bottom + 8,
      left: rect.left,
    });
    setOpen(true);
  }

  useEffect(() => {
    function handle(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function buildDays() {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }

  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const cells = buildDays();

  function handleDayClick(d) {
    const key = toDateKey(viewYear, viewMonth, d);
    if (key === selectedDate) {
      onClear();
    } else {
      onSelect(key);
    }
    setOpen(false);
  }

  return (
    <div className="cal-wrapper" ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`cal-trigger${selectedDate ? ' active' : ''}`}
        onClick={() => open ? setOpen(false) : openPopup()}
        title={selectedDate ? `Filtering by ${selectedDate}` : 'Filter by date'}
      >
        {selectedDate ? selectedDate.slice(5).replace('-', '/') : '📅'}
      </button>

      {selectedDate && (
        <button type="button" className="cal-clear" onClick={onClear} title="Clear date">✕</button>
      )}

      {open && (
        <div className="cal-popup" style={popupStyle}>
          <div className="cal-header">
            <button type="button" className="cal-nav" onClick={prevMonth}>‹</button>
            <span className="cal-month-label">
              {MONTHS[viewMonth]}{' '}
              {editingYear ? (
                <input
                  className="cal-year-input"
                  type="number"
                  value={yearInput}
                  autoFocus
                  onChange={e => setYearInput(e.target.value)}
                  onBlur={() => {
                    const y = parseInt(yearInput);
                    if (y > 1900 && y < 2200) setViewYear(y);
                    setEditingYear(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const y = parseInt(yearInput);
                      if (y > 1900 && y < 2200) setViewYear(y);
                      setEditingYear(false);
                    } else if (e.key === 'Escape') {
                      setEditingYear(false);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="cal-year-btn"
                  onClick={() => { setYearInput(String(viewYear)); setEditingYear(true); }}
                  title="Click to change year"
                >
                  {viewYear}
                </button>
              )}
            </span>
            <button type="button" className="cal-nav" onClick={nextMonth}>›</button>
          </div>

          <div className="cal-grid">
            {DAYS.map(d => (
              <span key={d} className="cal-day-name">{d}</span>
            ))}
            {cells.map((d, i) => {
              if (!d) return <span key={`empty-${i}`} />;
              const key = toDateKey(viewYear, viewMonth, d);
              const isToday = key === todayKey;
              const isSelected = key === selectedDate;
              return (
                <button
                  key={key}
                  type="button"
                  className={`cal-day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
                  onClick={() => handleDayClick(d)}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
