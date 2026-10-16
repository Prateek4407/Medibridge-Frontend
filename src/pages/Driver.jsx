import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store.js';
import { useApp } from '../context.jsx';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/hooks.js';
import { fmtTime } from '../lib/data.js';

const SEND_EVERY_MS = 4000;

/* =====================================================================
   AMBULANCE DRIVER: shows the linked vehicle and shares real GPS while the page is open
   ===================================================================== */
export default function Driver() {
  const { toast } = useApp();
  const s = useStore('mb_session', null);
  const mine = useFetch(() => api.get('/ambulances/mine'), [], { interval: 5000 });
  const amb = mine.data ? mine.data.data.ambulance : null;

  const [sharing, setSharing] = useState(false);
  const [gpsMsg, setGpsMsg] = useState('');
  const [lastSent, setLastSent] = useState(null);
  const watchId = useRef(null), lastPos = useRef(null), timer = useRef(null);

  const stop = () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    clearInterval(timer.current); watchId.current = null; setSharing(false);
  };
  useEffect(() => stop, []); // eslint-disable-line  (stop sharing when leaving the page)

  const start = () => {
    if (!navigator.geolocation) { setGpsMsg('This browser cannot share GPS. Use a phone browser.'); return; }
    setGpsMsg('Waiting for GPS…');
    watchId.current = navigator.geolocation.watchPosition(
      (p) => { lastPos.current = { lat: p.coords.latitude, lng: p.coords.longitude }; setGpsMsg(''); },
      (e) => { setGpsMsg(e.code === 1 ? 'Location permission was denied. Allow it in the browser settings.' : 'Could not read your location: ' + e.message); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
    const send = async () => {
      if (!lastPos.current) return;
      try { await api.patch('/ambulances/mine/location', { body: lastPos.current }); setLastSent(new Date()); }
      catch (ex) { setGpsMsg(ex.message); }
    };
    timer.current = setInterval(send, SEND_EVERY_MS);
    setSharing(true);
  };

  const setStatus = async (status) => {
    try { await api.patch('/ambulances/mine/status', { body: { status } }); mine.reload(); toast(status === 'available' ? 'You are available for dispatch' : 'You are offline'); }
    catch (ex) { toast(ex.message); }
  };

  return (
    <>
      <div className="card hero-a">
        <div><span className="badge declared">Ambulance driver</span>
          <h1 style={{ marginTop: 8 }}>{s.name}</h1>
          <p className="muted">Ambulance crew console</p></div>
        <span className="badge simulated">Prototype: not a certified dispatch system</span>
      </div>

      {!amb ? (
        <div className="card empty">
          <h3>{mine.loading ? 'Loading…' : mine.error ? 'Cannot load your ambulance' : 'No ambulance linked yet'}</h3>
          <p className="muted" style={{ marginTop: 6 }}>{mine.error ? mine.error.message : 'Ask the hospital to add your email (' + s.email + ') as the driver login of your ambulance in the doctor console.'}</p>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <h3>{amb.registration} &bull; {amb.type}</h3>
            <span className={'badge ' + (amb.status === 'available' ? 'green' : amb.status === 'assigned' ? 'estimated' : 'simulated')}>
              {amb.status === 'assigned' ? 'On case ' + amb.assignedCase : amb.status}
            </span>
          </div>
          <p className="small muted" style={{ marginBottom: 14 }}>
            Base: {amb.hospital}{amb.equipment && amb.equipment.length ? ' \u2022 ' + amb.equipment.join(', ') : ''}
          </p>

          <div className="consentbox">
            <div>
              <b>{sharing ? 'Sharing your live location' : 'Live location is off'}</b>
              <small className="muted">
                {sharing ? 'Keep this page open. Patients tracking your case see your real position.' : 'Turn this on while you are on duty so tracking uses real GPS instead of a simulation.'}
                {lastSent ? ' Last sent ' + lastSent.toLocaleTimeString('en-IN') + '.' : ''}
              </small>
            </div>
            <button className={sharing ? 'b-out' : 'b-primary'} onClick={sharing ? stop : start}>{sharing ? 'Stop sharing' : 'Share my live location'}</button>
          </div>
          {gpsMsg && <p className="err">{gpsMsg}</p>}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="b-out" disabled={amb.status === 'assigned' || amb.status === 'available'} onClick={() => setStatus('available')}>Go available</button>
            <button className="b-out" disabled={amb.status === 'assigned' || amb.status === 'offline'} onClick={() => setStatus('offline')}>Go offline</button>
          </div>
          {amb.status === 'assigned' && (
            <p className="small muted" style={{ marginTop: 12 }}>You are on an active case. <a className="lnk" href={'#/tracking?case=' + amb.assignedCase}>Open live tracking for {amb.assignedCase}</a></p>
          )}
          {amb.location && amb.location.updatedAt && <p className="small muted" style={{ marginTop: 8 }}>Last position on record: {fmtTime(amb.location.updatedAt)} ({amb.location.source}).</p>}
        </div>
      )}
    </>
  );
}
