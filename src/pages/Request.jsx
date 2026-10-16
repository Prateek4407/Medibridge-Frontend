import React, { useEffect, useState } from 'react';
import { store, useStore } from '../lib/store.js';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/hooks.js';
import { useApp, go } from '../context.jsx';
import { Seg, Field } from '../components/ui.jsx';

const STEPS = ['Patient Bio', 'Triage & Category', 'Pickup Location', 'Review & Dispatch'];
const SEV_T = { P1: 'P1 Critical', P2: 'P2 Serious', P3: 'P3 Stable' };

export default function Request() {
  const { toast } = useApp();
  const session = useStore('mb_session', null);
  const draft = store.get('mb_draft', {});
  const [step, setStep] = useState(1);
  const [bad, setBad] = useState({});
  const [gps, setGps] = useState(null);
  const [gpsMsg, setGpsMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [best, setBest] = useState(null);
  const hospQ = useFetch(() => api.get('/hospitals'), []);
  const HOSP = hospQ.data ? hospQ.data.data.hospitals : [];
  const [f, setF] = useState(() => ({
    name: session && session.role === 'patient' ? session.name : '', age: '', sex: 'Male', phone: '', rel: 'Self',
    care: 'Emergency', sev: 'P2', sym: '', hosp: draft.hospital || 'auto', addr: '', land: '', consent: false,
  }));
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const inp = (k) => ({ value: f[k], onChange: (e) => set(k, e.target.value) });

  /* "Best match" is decided by the server */
  useEffect(() => {
    if (step !== 4 || f.hosp !== 'auto') return;
    setBest(null);
    api.get('/hospitals/best-match?care=' + f.care).then((r) => setBest(r.data.hospital)).catch(() => setBest(null));
  }, [step, f.care, f.hosp]);
  const chosen = () => (f.hosp === 'auto' ? best : HOSP.find((x) => x.id === f.hosp) || null);

  function validate(n) {
    let b = {};
    if (n === 1) b = { name: f.name.trim().length < 2, age: !(f.age !== '' && +f.age >= 0 && +f.age <= 120), phone: !/^[6-9]\d{9}$/.test(f.phone.trim()) };
    if (n === 3) b = { addr: f.addr.trim().length < 5 };
    if (n === 4) b = { consent: !f.consent };
    setBad(b);
    return !Object.values(b).some(Boolean);
  }

  async function sendRequest() {
    setBusy(true);
    try {
      const r = await api.post('/cases', { body: {
        name: f.name.trim(), age: +f.age, sex: f.sex, phone: f.phone.trim(), rel: f.rel, care: f.care, sev: f.sev,
        symptoms: f.sym.trim(), hospital: f.hosp, address: f.addr.trim(), landmark: f.land.trim(), gps, consent: f.consent,
      } });
      store.set('mb_active', r.data.case.caseId);
      store.del('mb_draft');
      toast(r.message || 'Request sent.');
      go('tracking');
    } catch (ex) {
      const e = ex.errors || {};
      if (e.name || e.age || e.phone || e.sex) { setStep(1); setBad({ name: !!e.name, age: !!e.age, phone: !!e.phone }); }
      else if (e.address) { setStep(3); setBad({ addr: true }); }
      toast(ex.message);
    }
    setBusy(false);
  }

  const next = () => {
    if (busy) return;
    if (!validate(step)) { toast('Please complete the highlighted fields.'); return; }
    if (step < 4) { setStep(step + 1); setBad({}); return; }
    sendRequest();
  };

  const useGps = () => {
    if (!navigator.geolocation) { setGpsMsg('GPS is not available on this device. Type the address instead.'); return; }
    setGpsMsg('Finding your location...');
    navigator.geolocation.getCurrentPosition((p) => {
      const g = { lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) };
      setGps(g);
      setGpsMsg(<><span className="badge verified">GPS verified</span> {g.lat}, {g.lng}</>);
      if (!f.addr.trim()) set('addr', 'Current location (' + g.lat + ', ' + g.lng + ')');
    }, () => setGpsMsg('Could not get your location. Please type the address.'), { timeout: 8000 });
  };

  const h = step === 4 ? chosen() : null;
  const summary = step === 4 ? [
    ['Patient', f.name.trim() + ', ' + f.age + ' (' + f.sex + ')'], ['Callback', '+91 ' + f.phone.trim()], ['Caller', f.rel],
    ['Care needed', f.care], ['Priority', SEV_T[f.sev]], ['Symptoms', f.sym.trim() || 'Not provided'],
    ['Pickup', f.addr.trim() + (f.land.trim() ? ' (' + f.land.trim() + ')' : '')], ['Hospital', h ? h.name + (f.hosp === 'auto' ? ' (best match)' : '') : 'Finding the best match…'],
  ] : [];

  return (
    <>
      <div className="alert" style={{ marginBottom: 16 }}>
        <div><div className="eyebrow-a" style={{ color: '#fff', opacity: 0.85 }}>Immediate life threat advisory</div>
          <h3>For life-threatening emergencies, call 112 or 102 now.</h3>
          <p>This prototype demonstrates how a request would be coordinated. It does not dispatch a real ambulance.</p></div>
        <div className="acts"><a className="b-out" href="tel:112">Call 112</a></div>
      </div>
      <div className="card">
        <div className="eyebrow-a" style={{ color: 'var(--teal2)' }}>Intake pipeline &bull; no login needed</div>
        <h1 className="ph" style={{ marginTop: 2 }}>Rapid Emergency Request &amp; Intake</h1>
        <div className="stepper" id="stepper">
          {STEPS.map((s, i) => <div key={s} className={'stp' + (i + 1 === step ? ' on' : '') + (i + 1 < step ? ' done' : '')}><i>{i + 1}</i>{s}</div>)}
        </div>
      </div>

      <div className="g2-wide">
        <div className="card">
          <form onSubmit={(e) => e.preventDefault()} noValidate>
            {step === 1 && (
              <div className="pane show">
                <div className="eyebrow-a" style={{ color: 'var(--muted)' }}>Step 1 of 4</div>
                <h3>Patient information &amp; caller profile</h3>
                <Field label="Patient full name" req htmlFor="qName" bad={bad.name} msg="Enter the patient's name."><input id="qName" type="text" placeholder="e.g. Rajesh Kumar Verma" {...inp('name')} /></Field>
                <div className="row2">
                  <Field label="Age in years" req htmlFor="qAge" bad={bad.age} msg="Enter an age between 0 and 120."><input id="qAge" type="number" min="0" max="120" placeholder="e.g. 58" {...inp('age')} /></Field>
                  <Field label="Biological sex" req><Seg value={f.sex} onChange={(v) => set('sex', v)} options={['Male', 'Female', 'Other']} /></Field>
                </div>
                <Field label="Contact number (ambulance callback)" req bad={bad.phone} msg="Enter a 10-digit Indian mobile number.">
                  <div className="phone"><span>+91</span><input id="qPhone" type="tel" maxLength={10} placeholder="9876543210" {...inp('phone')} /></div>
                </Field>
                <Field label="Caller's relationship to patient" req><Seg value={f.rel} onChange={(v) => set('rel', v)} options={['Self', 'Spouse', 'Child', 'Parent', 'Good Samaritan']} /></Field>
              </div>
            )}
            {step === 2 && (
              <div className="pane show">
                <div className="eyebrow-a" style={{ color: 'var(--muted)' }}>Step 2 of 4</div>
                <h3>Triage &amp; care category</h3>
                <Field label="Care needed" req><Seg value={f.care} onChange={(v) => set('care', v)} options={['Emergency', 'Cardiac', 'Trauma', 'Maternity']} /></Field>
                <Field label="How serious is it?" req><Seg className="sev" value={f.sev} onChange={(v) => set('sev', v)} options={[['P1', 'P1 Critical'], ['P2', 'P2 Serious'], ['P3', 'P3 Stable']]} /></Field>
                <Field label="Symptoms (optional)" htmlFor="qSym"><textarea id="qSym" placeholder="e.g. chest pain for 30 minutes, sweating" {...inp('sym')} /></Field>
                <Field label="Preferred hospital (optional)" htmlFor="qHosp" hint={'Leave on "Best match" and MediBridge will pick the best fit.'}>
                  <select id="qHosp" {...inp('hosp')}>
                    <option value="auto">Best match (recommended)</option>
                    {HOSP.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </Field>
              </div>
            )}
            {step === 3 && (
              <div className="pane show">
                <div className="eyebrow-a" style={{ color: 'var(--muted)' }}>Step 3 of 4</div>
                <h3>Pickup location &amp; GPS confirmation</h3>
                <Field label="Pickup address" req htmlFor="qAddr" bad={bad.addr} msg="Enter the pickup address (at least 5 characters)."><input id="qAddr" type="text" placeholder="House / street, area, city" {...inp('addr')} /></Field>
                <Field label="Nearby landmark (optional)" htmlFor="qLand"><input id="qLand" type="text" placeholder="e.g. opposite the metro station" {...inp('land')} /></Field>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button type="button" className="b-out" onClick={useGps}>Use my current location</button>
                  <span className="small muted">{gpsMsg || 'GPS not used yet.'}</span>
                </div>
                <div className="minimap"><svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice">
                  <path d="M0 110 L400 60 M120 0 L170 150 M260 0 L230 150 M0 30 L400 130" stroke="#fff" strokeWidth="7" opacity=".8" />
                  <circle cx="200" cy="78" r="26" fill="#19c3b1" opacity=".25" /><circle cx="200" cy="78" r="9" fill="#e53935" stroke="#fff" strokeWidth="3" /></svg></div>
              </div>
            )}
            {step === 4 && (
              <div className="pane show">
                <div className="eyebrow-a" style={{ color: 'var(--muted)' }}>Step 4 of 4</div>
                <h3>Review &amp; dispatch</h3>
                <div className="sumlist">{summary.map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}</div>
                <Field style={{ marginTop: 16 }} bad={bad.consent} msg="Please tick the consent box to continue.">
                  <label className="checkrow"><input type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} /><span>I agree to share these details with the selected hospital and ambulance team for this request.</span></label>
                </Field>
              </div>
            )}
            <div className="formnav">
              <button type="button" className="b-out" style={{ visibility: step === 1 ? 'hidden' : 'visible' }} onClick={() => { setBad({}); setStep(step - 1); }}>Back</button>
              <span className="small muted">Your request is sent to the MediBridge server.</span>
              <button type="button" className={step === 4 ? 'b-red' : 'b-primary'} onClick={next} disabled={busy}>{step === 4 ? (busy ? 'Sending…' : 'Send emergency request') : 'Continue'}</button>
            </div>
          </form>
        </div>
        <aside>
          <div className="card guide">
            <div className="eyebrow-a" style={{ color: 'var(--muted)' }}>Guidance note</div>
            <h3>Why accurate details matter</h3>
            <p>Age and phone help the system pick the right hospital (paediatric or adult care) and let the ambulance team call you back.</p>
            <span className="badge declared">Declared by caller</span>
          </div>
          <div className="card guide">
            <div className="eyebrow-a" style={{ color: 'var(--muted)' }}>After you send</div>
            <h3>What happens next</h3>
            <p>A case ID is created, the best hospital is matched, and you can follow the ambulance on the Live Tracking page.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
