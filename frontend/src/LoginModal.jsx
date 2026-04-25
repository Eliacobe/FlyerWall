import { useState } from 'react';
import { login, register } from './api';

const RULES = [
  { label: 'At least 6 characters', test: p => p.length >= 6 },
  { label: 'One uppercase letter',  test: p => /[A-Z]/.test(p) },
  { label: 'One number',            test: p => /[0-9]/.test(p) },
  { label: 'One special character', test: p => /[^A-Za-z0-9]/.test(p) },
];

export default function LoginModal({ onAuth, onClose })
{
  const [tab, setTab] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const isRegister = tab === 'register';
  const ruleResults = RULES.map(r => ({ ...r, met: r.test(password) }));
  const passwordValid = ruleResults.every(r => r.met);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (isRegister && !passwordValid) return;
    setLoading(true);
    try {
      const data = isRegister
        ? await register(username, password)
        : await login(username, password);
      onAuth(data.token, data.username);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-tabs">
          <button
            className={`modal-tab${tab === 'login' ? ' active' : ''}`}
            onClick={() => { setTab('login'); setError(''); setPassword(''); setPasswordTouched(false); }}
          >
            Log in
          </button>
          <button
            className={`modal-tab${isRegister ? ' active' : ''}`}
            onClick={() => { setTab('register'); setError(''); setPassword(''); setPasswordTouched(false); }}
          >
            Register
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setPasswordTouched(true); }}
              required
            />
          </div>

          {isRegister && passwordTouched && (
            <ul className="password-rules">
              {ruleResults.map(r => (
                <li key={r.label} className={`password-rule${r.met ? ' met' : ''}`}>
                  <span className="password-rule-icon">{r.met ? '✓' : '✗'}</span>
                  {r.label}
                </li>
              ))}
            </ul>
          )}

          {error && <p className="modal-error">{error}</p>}
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || (isRegister && passwordTouched && !passwordValid)}
          >
            {loading ? '...' : isRegister ? 'Register' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}
