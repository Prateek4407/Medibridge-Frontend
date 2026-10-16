import React, { useState } from 'react';
import { useApp } from '../context.jsx';
import { Field } from './ui.jsx';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/hooks.js';
import { fmtTime } from '../lib/data.js';

const TYPES = ['BLS', 'ALS', 'Cardiac', 'Neonatal', 'Patient Transport'];
const STATUS_BADGE = { available: 'green', assigned: 'estimated', offline: 'simulated', maintenance: 'red' };
const EMPTY = { registration: '', hospital: 'H1', type: 'BLS', driverName: '', driverPhone: '', driverEmail: '', equipment: '' };

/* location source -> short label (gps = sent by the driver's phone) */
const where = (a) => {
  const l = a.location;
  if (!l || l.lat == null) return 'Unknown';
  const src = l.source === 'gps' ? 'Live GPS' : l.source === 'manual' ? 'Set by staff' : 'At base';
  return src + (l.updatedAt ? ' \u2022 ' + fmtTime(l.updatedAt) : '');
};

/* =====================================================================
   DOCTOR / HOSPITAL STAFF: manage the ambulance fleet
   ===================================================================== */
export function AmbulanceManager() {
  const { toast } = useApp();
  const fleet = useFetch(() => api.get('/ambulances'), [], { interval: 5000 });
  const hosp = useFetch(() => api.get('/hospitals'), []);
  const list = fleet.data ? fleet.data.data.ambulances : [];
  const hospitals = hosp.data ? hosp.data.data.hospitals : [];
  const hName = (id) => (hospitals.find((h) => h.id === id) || { name: id }).name;
  const count = (s) => list.filter((a) => a.status === s).length;

  const [f, setF] = useState(EMPTY);
  const [err, setErr] = useState({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function add(e) {
    e.preventDefault();
    setBusy(true); setMsg(''); setErr({});
    try {
      const body = { ...f, driverEmail: f.driverEmail.trim() || undefined };
      const r = await api.post('/ambulances', { body });
      toast(r.message || 'Ambulance added'); setF({ ...EMPTY, hospital: f.hospital }); fleet.reload();
    } catch (ex) { setErr(ex.errors || {}); setMsg(ex.message); }
    setBusy(false);
  }
  async function patch(a, body) {
    try { await api.patch('/ambulances/' + a.id, { body }); fleet.reload(); } catch (ex) { toast(ex.message); }
  }
  async function remove(a) {
    if (!window.confirm('Remove ambulance ' + a.registration + '?')) return;
    try { await api.del('/ambulances/' + a.id); toast('Ambulance removed'); fleet.reload(); } catch (ex) { toast(ex.message); }
  }

  return (
    <div className="card" id="ambulances" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h3>Ambulance management</h3>
        <span className="badge declared">{list.length} vehicle{list.length === 1 ? '' : 's'}</span>
      </div>
      <p className="small muted" style={{ marginBottom: 14 }}>
        The nearest free ambulance is assigned automatically when a hospital confirms a request, and freed when the case ends.
        Link a driver account to receive real GPS positions from the driver's phone; without one, the position on the tracking page is simulated.
      </p>

      <div className="ambgrid">
        <div><small>Total</small><b>{list.length}</b></div>
        <div><small>Available</small><b style={{ color: '#047857' }}>{count('available')}</b></div>
        <div><small>On a case</small><b style={{ color: '#b45309' }}>{count('assigned')}</b></div>
        <div><small>Offline / maintenance</small><b>{count('offline') + count('maintenance')}</b></div>
      </div>

      <div className="tblwrap">
        <table className="tbl">
          <thead><tr><th>Vehicle</th><th>Base hospital</th><th>Type</th><th>Driver</th><th>Location</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list.length ? list.map((a) => (
              <tr key={a.id}>
                <td><b>{a.registration}</b>{a.equipment && a.equipment.length > 0 && <><br /><small className="muted">{a.equipment.join(', ')}</small></>}</td>
                <td>{hName(a.hospital)}</td>
                <td><span className="badge declared">{a.type}</span></td>
                <td>{a.driverName || '-'}{a.driverUser ? <><br /><small className="muted">Login: {a.driverUser.email}</small></> : <><br /><small className="muted">No driver login</small></>}</td>
                <td><small>{where(a)}</small></td>
                <td>
                  {a.status === 'assigned'
                    ? <span className={'badge ' + STATUS_BADGE.assigned}>On case {a.assignedCase}</span>
                    : <select className="amb-status" value={a.status} aria-label={'Status of ' + a.registration} onChange={(e) => patch(a, { status: e.target.value })}>
                      <option value="available">Available</option><option value="offline">Offline</option><option value="maintenance">Maintenance</option>
                    </select>}
                </td>
                <td><a className="lnk" onClick={() => remove(a)}>Remove</a></td>
              </tr>
            )) : <tr><td colSpan="7" className="muted">{fleet.error ? fleet.error.message : fleet.loading && !fleet.data ? 'Loading ambulances…' : 'No ambulances yet. Add the first one below. Until a fleet exists, tracking stays fully simulated.'}</td></tr>}
          </tbody>
        </table>
      </div>

      <h3 style={{ marginTop: 22, fontSize: 15 }}>Add an ambulance</h3>
      <form onSubmit={add} noValidate>
        <div className="row2">
          <Field label="Vehicle number" req htmlFor="aReg" bad={!!err.registration} msg={err.registration}><input id="aReg" type="text" placeholder="e.g. DL1CAB1234" value={f.registration} onChange={set('registration')} /></Field>
          <Field label="Base hospital" req htmlFor="aHosp" bad={!!err.hospital} msg={err.hospital}>
            <select id="aHosp" value={f.hospital} onChange={set('hospital')}>{hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
          </Field>
        </div>
        <div className="row2">
          <Field label="Type" htmlFor="aType"><select id="aType" value={f.type} onChange={set('type')}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Equipment (comma separated)" htmlFor="aEq"><input id="aEq" type="text" placeholder="Defibrillator, Oxygen" value={f.equipment} onChange={set('equipment')} /></Field>
        </div>
        <div className="row2">
          <Field label="Driver name" htmlFor="aDn"><input id="aDn" type="text" value={f.driverName} onChange={set('driverName')} /></Field>
          <Field label="Driver phone" htmlFor="aDp" bad={!!err.driverPhone} msg={err.driverPhone}><input id="aDp" type="tel" maxLength={10} value={f.driverPhone} onChange={set('driverPhone')} /></Field>
        </div>
        <Field label="Driver login email (optional)" htmlFor="aDe" bad={!!err.driverEmail} msg={err.driverEmail} hint="The driver registers as 'Ambulance driver' first. Linking lets their phone send live GPS.">
          <input id="aDe" type="email" value={f.driverEmail} onChange={set('driverEmail')} />
        </Field>
        <p className="err">{msg}</p>
        <button className="b-primary" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add ambulance'}</button>
      </form>
    </div>
  );
}
