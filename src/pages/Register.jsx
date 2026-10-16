import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { Seg, Field } from '../components/ui.jsx';
import { afterLogin } from './Login.jsx';

export default function Register() {
  const app = useApp();
  const [role, setRole] = useState('patient');
  const [f, setF] = useState({ name: '', email: '', phone: '', spec: '', pass: '', conf: '' });
  const [bad, setBad] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);   // set after a doctor / driver signs up: they wait for approval
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const b = {
      name: f.name.trim().length < 2,
      email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()),
      phone: !/^[6-9]\d{9}$/.test(f.phone.trim()),
      pass: f.pass.length < 6,
      conf: f.conf !== f.pass || !f.conf,
      spec: role === 'doctor' && f.spec.trim().length < 2,
    };
    setBad(b);
    if (Object.values(b).some(Boolean)) { setErr('Please fix the highlighted fields.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await api.post('/auth/register', { body: { role, name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), password: f.pass, confirmPassword: f.conf, spec: f.spec.trim() } });
      if (r.pending) { setPending({ name: f.name.trim(), role }); return; }   // doctors and drivers get no session until an administrator approves them
      afterLogin(r.data, app);
    } catch (ex) {
      const errs = ex.errors || {};
      setBad({ name: !!errs.name, email: !!errs.email, phone: !!errs.phone, pass: !!errs.password, conf: !!errs.confirmPassword, spec: !!(errs.spec || errs.speciality) });
      // show the server's real reason (it can be about the role or a field the form cannot highlight)
      setErr(Object.values(errs).join(' ') || ex.message);
    }
    setBusy(false);
  };

  if (pending) {
    return (
      <div className="authwrap">
        <div className="card">
          <h1>Request received</h1>
          <p className="muted" style={{ margin: '8px 0 16px' }}>
            Thank you, {pending.name}. Your {pending.role === 'doctor' ? 'doctor' : 'ambulance driver'} account has been created and is <b>waiting for administrator approval</b>.
            You will be able to log in as soon as it is approved.
          </p>
          <a className="b-primary wide" href="#/login" style={{ display: 'block', textAlign: 'center' }}>Go to Login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="authwrap">
      <div className="card">
        <h1>Create your account</h1>
        <p className="muted" style={{ marginBottom: 20 }}>Patients, doctors and ambulance drivers each get their own dashboard. Doctor and driver accounts are active after an administrator approves them.</p>
        <form onSubmit={submit} noValidate>
          <Field label="I am a"><Seg value={role} onChange={setRole} options={[['patient', 'Patient'], ['doctor', 'Doctor'], ['driver', 'Ambulance driver']]} /></Field>
          <Field label="Full name" req htmlFor="rName" bad={bad.name} msg="Enter your full name."><input id="rName" type="text" autoComplete="name" value={f.name} onChange={set('name')} /></Field>
          <div className="row2">
            <Field label="Email" req htmlFor="rEmail" bad={bad.email} msg="Enter a valid email."><input id="rEmail" type="email" autoComplete="email" value={f.email} onChange={set('email')} /></Field>
            <Field label="Phone" req htmlFor="rPhone" bad={bad.phone} msg="Enter a 10-digit mobile number."><input id="rPhone" type="tel" maxLength={10} autoComplete="tel" value={f.phone} onChange={set('phone')} /></Field>
          </div>
          {role === 'doctor' && (
            <Field label="Speciality / department" req htmlFor="rSpec" bad={bad.spec} msg="Enter the speciality / department."><input id="rSpec" type="text" placeholder="e.g. Emergency Medicine" value={f.spec} onChange={set('spec')} /></Field>
          )}
          <div className="row2">
            <Field label="Password" req htmlFor="rPass" bad={bad.pass} msg="At least 6 characters."><input id="rPass" type="password" autoComplete="new-password" value={f.pass} onChange={set('pass')} /></Field>
            <Field label="Confirm password" req htmlFor="rConf" bad={bad.conf} msg="Passwords do not match."><input id="rConf" type="password" autoComplete="new-password" value={f.conf} onChange={set('conf')} /></Field>
          </div>
          <p className="err">{err}</p>
          <button className="b-primary wide" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create Account'}</button>
        </form>
        <p className="linkrow">Already have an account? <a href="#/login">Login</a></p>
      </div>
    </div>
  );
}