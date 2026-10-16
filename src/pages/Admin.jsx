import React, { useState } from 'react';
import { useStore } from '../lib/store.js';
import { useApp } from '../context.jsx';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/hooks.js';
import { fmtTime } from '../lib/data.js';

const TABS = [['pending', 'Waiting for approval'], ['active', 'Approved'], ['rejected', 'Rejected']];
const ROLE = { doctor: 'Doctor', driver: 'Ambulance driver' };

/* =====================================================================
   ADMINISTRATOR: approve, reject or revoke doctor and ambulance-driver accounts
   ===================================================================== */
export default function Admin() {
  const { toast } = useApp();
  const s = useStore('mb_session', null);
  const [tab, setTab] = useState('pending');
  const [busy, setBusy] = useState('');
  const q = useFetch(() => api.get('/admin/users?status=' + tab), [tab], { interval: 8000 });
  const users = q.data ? q.data.data.users : [];
  const counts = q.data ? q.data.data.counts : { pending: 0, active: 0, rejected: 0 };

  async function setStatus(u, status) {
    if (status === 'rejected' && u.status === 'active' && !window.confirm('Revoke access for ' + u.name + '? They will be logged out of protected pages.')) return;
    setBusy(u.id);
    try { const r = await api.patch('/admin/users/' + u.id + '/status', { body: { status } }); toast(r.message); q.reload(); }
    catch (ex) { toast(ex.message); }
    setBusy('');
  }

  return (
    <>
      <div className="card hero-a">
        <div><span className="badge declared">Administrator</span>
          <h1 style={{ marginTop: 8 }}>{s.name}</h1>
          <p className="muted">Doctors and ambulance drivers can register on the website, but can only log in after you approve them.</p></div>
        <span className={'badge ' + (counts.pending ? 'estimated' : 'green')}>{counts.pending} waiting</span>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="tabs-a" style={{ marginBottom: 12 }}>
          {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l} ({counts[k]})</button>)}
        </div>
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th>Name</th><th>Role</th><th>Contact</th><th>Registered</th><th></th></tr></thead>
            <tbody>
              {users.length ? users.map((u) => (
                <tr key={u.id}>
                  <td><b>{u.name}</b>{u.spec ? <><br /><small className="muted">{u.spec}</small></> : null}</td>
                  <td><span className="badge declared">{ROLE[u.role] || u.role}</span></td>
                  <td>{u.email}<br /><small className="muted">{u.phone}</small></td>
                  <td><small>{u.createdAt ? fmtTime(u.createdAt) : '-'}</small></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {u.status !== 'active' && <button className="b-primary b-sm" disabled={busy === u.id} onClick={() => setStatus(u, 'active')}>Approve</button>}{' '}
                    {u.status !== 'rejected' && <button className="b-out b-sm" disabled={busy === u.id} onClick={() => setStatus(u, 'rejected')}>{u.status === 'active' ? 'Revoke' : 'Reject'}</button>}
                  </td>
                </tr>
              )) : <tr><td colSpan="5" className="muted">{q.error ? q.error.message : q.loading && !q.data ? 'Loading…' : tab === 'pending' ? 'No one is waiting for approval.' : 'Nothing here yet.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
