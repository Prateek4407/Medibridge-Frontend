import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { store, useStore } from '../lib/store.js';
import { useApp } from '../context.jsx';
import { STAGES, STEP_MS } from '../lib/data.js';
import { api, normCase, API_BASE } from '../lib/api.js';

const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
const newVitals = () => ({ hr: rnd(108, 118), sys: rnd(136, 144), dia: rnd(86, 92), spo2: rnd(95, 97), rr: rnd(20, 24) });

/* Which ambulance is coming, and whether its position is real GPS or a simulation. */
function AmbulanceCard({ c }) {
  const a = c.ambulance;
  const pos = a && a.position;
  const live = pos && pos.source === 'live';
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h3>Assigned ambulance</h3>
        {a && <span className={'badge ' + (live ? 'green' : 'simulated')}>{live ? 'Live GPS' : 'Simulated position'}</span>}
      </div>
      {a ? (
        <>
          <h4 style={{ fontSize: 17, marginTop: 8 }}>{a.registration}</h4>
          <p className="muted small">{a.type}{a.equipment && a.equipment.length ? ' \u2022 ' + a.equipment.join(', ') : ''}</p>
          {pos && (
            <p className="small" style={{ marginTop: 8 }}>
              {live ? 'Position from the driver\'s phone, updated ' + new Date(pos.updatedAt).toLocaleTimeString('en-IN') + '. ' : 'This vehicle is not sending GPS, so its position is estimated from the case stage. '}
              <a className="lnk" href={'https://www.google.com/maps?q=' + pos.lat + ',' + pos.lng} target="_blank" rel="noreferrer">Open in Maps</a>
            </p>
          )}
          {a.driverName && <p className="small muted" style={{ marginTop: 6 }}>Driver: {a.driverName}{a.driverPhone ? ' \u2022 ' + a.driverPhone : ''}</p>}
        </>
      ) : (
        <p className="muted small" style={{ marginTop: 8 }}>{c.waitingForAmbulance ? 'The hospital has accepted. All ambulances are busy right now; the nearest one will be assigned as soon as it is free.' : 'An ambulance is assigned after the hospital confirms the request.'}</p>
      )}
    </div>
  );
}

export default function Tracking() {
  const { toast } = useApp();
  const activeId = useStore('mb_active', null);          // case id (CB-xxxx) being tracked
  const [snap, setSnap] = useState(null);                // { c: case from server, at: time it arrived }
  const [netErr, setNetErr] = useState('');
  const [now, setNow] = useState(Date.now());
  const c = snap ? snap.c : null;

  const [leg, setLeg] = useState('A');
  const legManual = useRef(false);
  const [vit, setVit] = useState(newVitals);
  const baseRef = useRef(), doneRef = useRef(), ambRef = useRef();
  const streaming = useRef(false);                     // true while the live stream (SSE) is connected

  /* a shared link looks like  #/tracking?case=CB-1234 */
  useEffect(() => {
    const id = new URLSearchParams(window.location.hash.split('?')[1] || '').get('case');
    if (id) store.set('mb_active', id);
  }, []);

  /* ask the server for the live view of the case every 1.5 s (public endpoint, works without login) */
  const load = useCallback(async () => {
    if (!activeId) return;
    try {
      const r = await api.get('/cases/' + encodeURIComponent(activeId) + '/track');
      setSnap({ c: normCase(r.data.case), at: Date.now() }); setNetErr('');
    } catch (e) {
      if (e.status === 404) { store.del('mb_active'); setSnap(null); } else setNetErr(e.message);
    }
  }, [activeId]);

  useEffect(() => {
    setSnap(null); setNetErr(''); legManual.current = false; streaming.current = false;
    if (!activeId) return undefined;
    load();

    /* live stream: the server pushes every change (new stage, new ambulance GPS position) as it happens.
       If the stream is not available the page falls back to asking every 1.5 s, exactly as before. */
    let es = null;
    if (typeof EventSource !== 'undefined') {
      es = new EventSource(API_BASE + '/cases/' + encodeURIComponent(activeId) + '/stream');
      es.onmessage = (m) => {
        try { setSnap({ c: normCase(JSON.parse(m.data).case), at: Date.now() }); setNetErr(''); streaming.current = true; } catch (e) { /* ignore a broken message */ }
      };
      es.addEventListener('done', () => { es.close(); streaming.current = false; });
      es.onerror = () => { streaming.current = false; };            // the browser reconnects by itself; polling covers the gap
    }
    const t = setInterval(() => { if (!streaming.current) load(); }, 1500);
    return () => { clearInterval(t); if (es) es.close(); streaming.current = false; };
  }, [activeId, load]);

  /* smooth animation between server updates + simulated vitals */
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    const v = setInterval(() => setVit(newVitals()), 1500);
    return () => { clearInterval(t); clearInterval(v); };
  }, []);

  useEffect(() => { if (c && !legManual.current) setLeg(c.stage >= 4 ? 'B' : 'A'); }, [c && c.stage]); // eslint-disable-line

  const frac = !c ? 0 : c.stage >= 5 ? 1 : Math.min(1, c.stageProgress + (now - snap.at) / STEP_MS);

  const startDemo = async () => {
    try { const r = await api.post('/cases/demo'); store.set('mb_active', r.data.case.caseId); } catch (e) { toast(e.message); }
  };
  const act = async (what) => {
    try {
      const r = await api.post('/cases/' + encodeURIComponent(activeId) + '/' + what);
      if (what === 'restart') { setLeg('A'); legManual.current = false; toast('Demo restarted'); }
      setSnap({ c: normCase(r.data.case), at: Date.now() });
    } catch (e) { toast(e.message); }
  };

  const s = c ? c.stage : 0;
  /* move the ambulance marker along the route */
  useLayoutEffect(() => {
    if (!c || !baseRef.current) return;
    const path = baseRef.current, len = path.getTotalLength();
    const prog = leg === 'A' ? (s < 2 ? 0 : s === 2 ? frac : 1) : (s < 4 ? 0 : s === 4 ? frac : 1);
    const pos = leg === 'A' ? prog : 1 - prog;
    const pt = path.getPointAtLength(len * pos);
    ambRef.current.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
    doneRef.current.setAttribute('stroke-dasharray', (len * prog) + ' ' + (len * 2));
    doneRef.current.setAttribute('stroke-dashoffset', leg === 'A' ? 0 : -(len * (1 - prog)));
  });

  if (activeId && !c) {
    return (
      <div className="card empty">
        <h3>{netErr ? 'Cannot load this case' : 'Loading your case…'}</h3>
        {netErr && <><p className="muted" style={{ margin: '6px 0 14px' }}>{netErr}</p><button className="b-primary" onClick={load}>Try again</button></>}
      </div>
    );
  }
  if (!c) {
    return (
      <div className="card empty">
        <h3>No active case to track</h3>
        <p className="muted" style={{ margin: '6px 0 18px' }}>Send an emergency request, or start a demo case to see how tracking works.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="#/request" className="b-red">Request Emergency Help</a>
          <button className="b-primary" onClick={startDemo}>Start a demo case</button>
        </div>
      </div>
    );
  }

  const h = c.hospital;
  const remaining = s < 2 ? 20 - s * 2 : s === 2 ? 8 * (1 - frac) + 12 : s === 3 ? 12 : s === 4 ? 12 * (1 - frac) : 0;
  const live = c.waitingForAmbulance ? 'Hospital confirmed - waiting for a free ambulance' : s < 2 ? 'Hospital is confirming the request' : s === 2 ? 'Ambulance heading to the patient' : s === 3 ? 'Patient being loaded' : s === 4 ? 'Ambulance heading to hospital' : 'Patient arrived at hospital';
  const cor = s < 2 ? 'Preparing' : s === 5 ? 'Completed' : 'Green corridor active';
  const code = { P1: 'P1 CRITICAL', P2: 'P2 SERIOUS', P3: 'P3 STABLE' }[c.sev];

  const setLegManual = (l) => { setLeg(l); legManual.current = true; };
  const share = () => {
    const link = window.location.href.split('#')[0] + '#/tracking?case=' + c.id;
    (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => toast('Live tracking link copied'), () => toast('Copy this link: ' + link));
  };

  return (
    <>
      <div className="banner">
        <div className="l"><span className={'code ' + c.sev.toLowerCase()}>{code}</span><span className="caseid">#{c.id}</span><span className="live">{live}</span></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="b-dark b-sm" style={{ border: '1px solid rgba(255,255,255,.3)' }} onClick={share}>Share live link</button>
          <a className="b-red b-sm" href="tel:112">Call 112</a>
        </div>
      </div>
      <div className="g2-wide">
        <div>
          <div className="card">
            <div className="eta-card">
              <div><h3 style={{ fontSize: 20 }}>{c.name}</h3><p className="muted">{c.age} yrs, {c.sex} &bull; {c.care} case</p></div>
              <div className="eta-big"><small>Dynamic ETA <span className="badge estimated">Simulated</span></small><b>{s === 5 ? 'Arrived' : '~' + Math.ceil(remaining) + ' mins'}</b></div>
            </div>
            <div className="tiles">
              <div><small>Pickup location</small><b>{c.address}</b></div>
              <div><small>Destination intake</small><b>{h.name}</b></div>
              <div><small>Corridor status</small><b style={{ color: '#047857' }}>{cor}</b></div>
            </div>
          </div>
          <div className="card">
            <h3>Live transit corridor map</h3>
            <div className="tabs-a">
              <button className={leg === 'A' ? 'on' : ''} onClick={() => setLegManual('A')}>Hospital &rarr; Location</button>
              <button className={leg === 'B' ? 'on' : ''} onClick={() => setLegManual('B')}>Location &rarr; Hospital</button>
            </div>
            <div className="routemap"><svg viewBox="0 0 400 240">
              <rect width="400" height="240" fill="#dff3f1" />
              <path d="M0 80 L400 40 M0 170 L400 210 M90 0 L140 240 M300 0 L260 240" stroke="#fff" strokeWidth="9" opacity=".85" />
              <path ref={baseRef} d="M330 50 C250 60 220 170 60 190" fill="none" stroke="#9bb5bd" strokeWidth="4" strokeDasharray="7 7" />
              <path ref={doneRef} d="M330 50 C250 60 220 170 60 190" fill="none" stroke="#0fa08f" strokeWidth="5" strokeLinecap="round" />
              <g transform="translate(330 50)"><circle r="16" fill="#0c2a42" /><text textAnchor="middle" y="6" fontSize="17" fill="#fff" fontWeight="800">H</text></g>
              <g transform="translate(60 190)"><circle r="16" fill="#e53935" /><text textAnchor="middle" y="6" fontSize="15" fill="#fff" fontWeight="800">P</text></g>
              <g ref={ambRef}><circle r="13" fill="#19c3b1" stroke="#fff" strokeWidth="3" /><text textAnchor="middle" y="5" fontSize="13" fill="#071a2b" fontWeight="800">+</text></g>
            </svg></div>
            <p className="small muted" style={{ marginTop: 8 }}><b>H</b> = hospital, <b>P</b> = patient pickup. Route is a simulation, not a real map.</p>
          </div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><h3>Patient vitals feed</h3><span className="badge simulated">Simulated telemetry</span></div>
            <div className="vitals">
              <div><small>Heart rate</small><b>{vit.hr}</b><em>BPM</em></div>
              <div><small>Blood pressure</small><b>{vit.sys}/{vit.dia}</b></div>
              <div><small>SpO2</small><b>{vit.spo2}</b><em>%</em></div>
              <div><small>Respiration</small><b>{vit.rr}</b><em>RPM</em></div>
            </div>
            <div className="ecg"><small>LEAD II &bull; CONTINUOUS (SIMULATED)</small>
              <svg viewBox="0 0 400 60" preserveAspectRatio="none"><path d="M0 35 H80 L95 35 L105 12 L118 52 L130 4 L142 35 H230 L245 35 L255 22 L268 44 L280 35 H400" /><path className="sweep" d="M0 35 H80 L95 35 L105 12 L118 52 L130 4 L142 35 H230 L245 35 L255 22 L268 44 L280 35 H400" /></svg></div>
          </div>
        </div>
        <aside>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><h3>Target facility</h3><span className="badge green">{s < 1 ? 'Pending' : 'Accepted'}</span></div>
            <h4 style={{ fontSize: 17, marginTop: 8 }}>{h.name}</h4>
            <p className="muted small">{h.area} &bull; {h.km} km away</p>
            <div className="tiles" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div><small>Allocated bay</small><b>Resus Bay 02</b></div>
              <div><small>Team</small><b>Pre-alerted</b></div>
            </div>
          </div>
          <AmbulanceCard c={c} />
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><h3>Case status timeline</h3><span className="badge declared">Stage {s + 1} of 6</span></div>
            <ol className="tl">
              {STAGES.map((st, i) => {
                const cls = i < s ? 'done' : i === s ? (s === 5 ? 'done' : 'now') : 'future';
                const t = c.timeline && c.timeline[i] && c.timeline[i].at;
                const when = i <= s && t ? new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Estimated';
                return (
                  <li key={i} className={cls}>
                    <div className="dot" dangerouslySetInnerHTML={{ __html: i < s || (i === s && s === 5) ? '&#10003;' : String(i + 1) }} />
                    <div><h4>{st[0]} <small>{when}</small></h4><small>{st[1]}</small></div>
                  </li>
                );
              })}
            </ol>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              <button className="b-out b-sm" onClick={() => act('advance')}>Advance step (demo)</button>
              <button className="b-out b-sm" onClick={() => act('restart')}>Restart demo</button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
