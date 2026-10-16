import React, { useState } from 'react';
import { api, saveAuth } from '../lib/api.js';
import { useApp, go } from '../context.jsx';
import { Seg, Field } from '../components/ui.jsx';
import { ROUTES } from '../lib/routes.js';

/* auth = { token, user } returned by /auth/login or /auth/register */
export function afterLogin(auth, { toast, nextAfterLogin }) {
  saveAuth(auth);
  toast('Welcome, ' + auth.user.name);
  const n = nextAfterLogin.current;
  const dest = n && ROUTES[n] && (!ROUTES[n].role || ROUTES[n].role === auth.user.role) ? n : auth.user.role;
  nextAfterLogin.current = null;
  go(dest);
}

export default function Login() {
  const app = useApp();
  const [role, setRole] = useState('patient');
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const idv = id.trim().toLowerCase();
    if (!idv || !pw) { setErr('Please enter your email/phone and password.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await api.post('/auth/login', { body: { identifier: idv, password: pw, role } });
      afterLogin(r.data, app);
    } catch (ex) { setErr(ex.message); }
    setBusy(false);
  };
  const demo = (r) => { setRole(r); setId(r + '@demo.test'); setPw('demo1234'); };

  return (
    <div className="authwrap">
      <div className="card">
        <h1>Welcome back</h1>
        <p className="muted" style={{ marginBottom: 20 }}>Sign in to open your dashboard.</p>
        <form onSubmit={submit} noValidate>
          <Field label="I am a"><Seg value={role} onChange={setRole} options={[['patient', 'Patient'], ['doctor', 'Doctor'], ['driver', 'Driver'], ['admin', 'Admin']]} /></Field>
          <Field label="Email or phone" htmlFor="lUser"><input id="lUser" type="text" autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} /></Field>
          <Field label="Password" htmlFor="lPass"><input id="lPass" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <p className="err">{err}</p>
          <button className="b-primary wide" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Login'}</button>
        </form>
        <div className="demo-box">
          <b>Try the demo accounts</b> (created by <code>npm run seed</code> on the backend).
          <div className="seg">
            <button type="button" onClick={() => demo('patient')}>Use demo patient</button>
            <button type="button" onClick={() => demo('doctor')}>Use demo doctor</button>
          </div>
        </div>
        <p className="linkrow">New here? <a href="#/register">Register</a></p>
        <p className="linkrow">In an emergency? <a href="#/request">Request help without logging in</a></p>
      </div>
    </div>
  );
}
