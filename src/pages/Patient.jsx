import React from 'react';
import { store, useStore } from '../lib/store.js';
import { useApp, go } from '../context.jsx';
import { STAGES, fmtTime, statusOf } from '../lib/data.js';
import { api, normCase } from '../lib/api.js';
import { useFetch } from '../lib/hooks.js';
import { PatientDocuments, useNeedsHistory } from '../components/Documents.jsx';
import { chooseHosp } from './Finder.jsx';

function PayModal({ inv, closeModal, toast, onPaid }) {
  const [pm, setPm] = React.useState('UPI');
  const [busy, setBusy] = React.useState(false);
  const confirm = async () => {
    setBusy(true);
    try { await api.post('/invoices/' + inv.invoiceId + '/pay', { body: { method: pm } }); closeModal(); toast('Payment marked as paid (demo)'); onPaid(); }
    catch (e) { toast(e.message); setBusy(false); }
  };
  return (
    <>
      <h3>Pay {inv.invoiceId}</h3>
      <p className="muted small" style={{ marginBottom: 12 }}>Demo only. No real payment is taken and no card details are asked.</p>
      <div className="rows"><div><span>Service</span><b>{inv.service}</b></div><div><span>Amount</span><b>&#8377;{inv.amount}</b></div></div>
      <div style={{ marginTop: 14 }}>
        {['UPI', 'Card', 'Pay at hospital'].map((m) => (
          <label className="opt" key={m}><input type="radio" name="pm" value={m} checked={pm === m} onChange={() => setPm(m)} /> {m}</label>
        ))}
      </div>
      <div className="acts"><button className="b-out" onClick={closeModal}>Cancel</button><button className="b-primary" onClick={confirm} disabled={busy}>{busy ? 'Paying…' : 'Confirm demo payment'}</button></div>
    </>
  );
}

function ReceiptModal({ inv, closeModal }) {
  return (
    <>
      <h3>Receipt {inv.invoiceId}</h3>
      <div className="rows"><div><span>Service</span><b>{inv.service}</b></div><div><span>Amount</span><b>&#8377;{inv.amount}</b></div><div><span>Method</span><b>{inv.method || 'UPI'}</b></div><div><span>Status</span><b>Paid</b></div></div>
      <p className="small muted" style={{ marginTop: 10 }}>Demo receipt for presentation only.</p>
      <div className="acts"><button className="b-primary" onClick={closeModal}>Close</button></div>
    </>
  );
}

export default function Patient() {
  const { toast, openModal, closeModal, pendingScroll } = useApp();
  const s = useStore('mb_session', null);
  const needsHistory = useNeedsHistory();

  /* everything below comes from the backend; the case list refreshes every 4 s so the stage stays current */
  const activeQ = useFetch(() => api.get('/cases/active'), [], { interval: 4000 });
  const casesQ = useFetch(() => api.get('/cases'), [], { interval: 4000 });
  const slotsQ = useFetch(() => api.get('/slots'), []);
  const invsQ = useFetch(() => api.get('/invoices'), []);
  const hospQ = useFetch(() => api.get('/hospitals?sort=eta'), []);

  const c = activeQ.data ? normCase(activeQ.data.data.case) : null;
  const running = !!c && c.stage < 5;
  const cases = casesQ.data ? casesQ.data.data.cases.map(normCase) : [];
  const slots = slotsQ.data ? slotsQ.data.data.slots : [];
  const invs = invsQ.data ? invsQ.data.data.invoices : [];
  const radar = hospQ.data ? hospQ.data.data.hospitals.slice(0, 3) : [];
  const firstError = [activeQ, casesQ, slotsQ, invsQ].map((x) => x.error).find((e) => e && e.status === 0);

  const book = async (id) => { try { await api.patch('/slots/' + id + '/book'); toast('Appointment booked'); } catch (e) { toast(e.message); } slotsQ.reload(); };
  const cancel = async (id) => { try { await api.patch('/slots/' + id + '/cancel'); toast('Appointment cancelled'); } catch (e) { toast(e.message); } slotsQ.reload(); };
  const showReceipt = async (i) => {
    try { const r = await api.get('/invoices/' + i.invoiceId + '/receipt'); openModal(<ReceiptModal inv={r.data.receipt} closeModal={closeModal} />); }
    catch (e) { toast(e.message); }
  };
  const jumpDocs = (e) => { e.preventDefault(); const el = document.getElementById('documents'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return (
    <>
      {firstError && <div className="docprompt" style={{ marginBottom: 14 }}><span>&#9888;</span><div><b>Cannot reach the server</b>{firstError.message}</div></div>}
      <div className="alert">
        <div><div className="eyebrow-a" style={{ color: '#fff', opacity: 0.85 }}>Critical protocol directive</div>
          <h3>Official life-threatening emergency reminder</h3>
          <p>For unresponsiveness, severe bleeding or breathing trouble, dial 112 or 102 immediately. MediBridge assists with hospital matching and tracking.</p></div>
        <div className="acts"><a className="b-out" href="tel:112">Instant Call 112</a></div>
      </div>
      <div className="card hero-a">
        <div><span className="badge declared">Patient account</span>
          <h1 style={{ marginTop: 8 }}>Welcome back, {s.name}</h1>
          <p className="muted">Your care hub: requests, documents, appointments and payments in one place.</p></div>
        <div className="stat">
          {needsHistory && <a href="#documents" onClick={jumpDocs} className="badge estimated">Medical history needed</a>}
          <span className={'badge ' + (running ? 'estimated' : 'green')}>{running ? 'Active case in progress' : 'No active case'}</span>
        </div>
      </div>
      <div className="g2-wide">
        <div className="card">
          <div className="eyebrow-a">Fast direct dispatch</div>
          <h3 style={{ fontSize: 22, margin: '4px 0' }}>Declare a medical emergency</h3>
          <p className="muted" style={{ marginBottom: 16 }}>Creates a case, matches the best hospital and starts live tracking.</p>
          <a href="#/request" className="b-red">Initiate new emergency request</a>
        </div>
        <div>
          <a className="qlink" href="#/finder"><span><b>Find hospitals</b><small className="muted">ICU beds, travel time, specialties</small></span><span>&rsaquo;</span></a>
          <a className="qlink" href="#/delay"><span><b>Predict response delay</b><small className="muted">Estimate how long an ambulance may take</small></span><span>&rsaquo;</span></a>
          <a className="qlink" href="#/tracking"><span><b>Live tracking</b><small className="muted">Follow your active case</small></span><span>&rsaquo;</span></a>
        </div>
      </div>

      <h2 className="ph" style={{ fontSize: 20 }}>Active emergency coordination</h2>
      <div className="card" id="pActive">
        {c ? (() => {
          const h = c.hospital, sv = statusOf(c);
          return (
            <>
              <div className="casehead"><div><span className={'code ' + c.sev.toLowerCase()}>{c.sev}</span> <span className="caseid">#{c.id}</span><h3 style={{ marginTop: 6 }}>{c.name}, {c.age}</h3><small>{c.care} &bull; to {h.name}</small></div>
                <div><small>Stage</small><div className="eta">{Math.min(c.stage + 1, 6)} / 6</div></div></div>
              <p style={{ margin: '12px 0' }}><span className={'badge ' + sv[1]}>{sv[0]}</span> &nbsp; {STAGES[c.stage][0]}: <span className="muted">{STAGES[c.stage][1]}</span></p>
              <a className="b-primary" href="#/tracking">View live tracking &amp; route</a>
            </>
          );
        })() : (
          <>
            <p className="muted">No active case. Start one from "Declare a medical emergency" above.</p>
            <a className="b-out" style={{ marginTop: 12 }} href="#/tracking">Open tracking demo</a>
          </>
        )}
      </div>

      {/* NEW: documents + medical history upload */}
      <PatientDocuments />

      <div className="g2" id="appointments" style={{ marginTop: 20 }}>
        <div className="card">
          <h3>My appointments</h3>
          <p className="small muted" style={{ marginBottom: 8 }}>Time slots set by doctors. Book one that suits you.</p>
          <ul className="list">
            {slots.length ? slots.map((x) => {
              const mine = x.status === 'mine', taken = x.status === 'taken';
              return (
                <li key={x.id}>
                  <span><b>{x.doctor}</b><small className="muted">{x.date} &bull; {x.from} to {x.to}{x.note ? ' \u2022 ' + x.note : ''}</small></span>
                  {taken ? <span className="badge simulated">Taken</span>
                    : mine ? <span><span className="badge green">Booked</span> <button className="b-out b-sm" onClick={() => cancel(x.id)}>Cancel</button></span>
                      : <button className="b-primary b-sm" onClick={() => book(x.id)}>Book</button>}
                </li>
              );
            }) : <li className="muted">{slotsQ.loading ? 'Loading…' : 'No time slots yet. A doctor needs to schedule some.'}</li>}
          </ul>
        </div>
        <div className="card" id="payments">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><h3>Payment dashboard</h3><span className="badge simulated">Demo only</span></div>
          <p className="small muted" style={{ marginBottom: 8 }}>No real payment is processed in this prototype.</p>
          <div className="tblwrap"><table className="tbl"><thead><tr><th>Invoice</th><th>Service</th><th>Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {invs.map((i) => (
                <tr key={i.id}><td>{i.invoiceId}</td><td>{i.service}</td><td>&#8377;{i.amount}</td>
                  <td><span className={'badge ' + (i.status === 'Paid' ? 'green' : 'estimated')}>{i.status}</span></td>
                  <td>{i.status === 'Paid'
                    ? <a className="lnk" onClick={() => showReceipt(i)}>Receipt</a>
                    : <button className="b-primary b-sm" onClick={() => openModal(<PayModal inv={i} closeModal={closeModal} toast={toast} onPaid={invsQ.reload} />)}>Pay now</button>}</td></tr>
              ))}
            </tbody></table></div>
        </div>
      </div>

      <h2 className="ph" style={{ fontSize: 20 }}>Regional hospital capability radar</h2>
      <div className="g3" id="radar">
        {radar.map((h) => (
          <div className="card" style={{ margin: 0 }} key={h.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span className={'badge ' + h.src.toLowerCase()}>{h.src}</span><b style={{ color: 'var(--teal2)' }}>{h.km} km</b></div>
            <h3 style={{ marginTop: 8 }}>{h.name}</h3><p className="muted small">{h.area} &bull; about {h.eta} mins</p>
            <div className="tiles" style={{ gridTemplateColumns: '1fr 1fr' }}><div><small>ICU beds</small><b>{h.icu}</b></div><div><small>Load</small><b>{h.load}</b></div></div>
            <button className="b-out wide" style={{ marginTop: 12 }} onClick={() => chooseHosp(h.id)}>Request help here</button>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>Recent care logs &amp; audit trail</h3>
        <p className="small muted" style={{ marginBottom: 8 }}>Records of the emergency requests made from your account.</p>
        <div className="tblwrap"><table className="tbl"><thead><tr><th>Case ID</th><th>Date &amp; time</th><th>Patient</th><th>Facility</th><th>Category</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {cases.map((x) => (
              <tr key={x.id}><td><b>#{x.id}</b></td><td>{fmtTime(x.created)}</td><td>{x.name}</td><td>{x.hospital.name}</td><td><span className="badge declared">{x.care}</span></td>
                <td><span className={'badge ' + statusOf(x)[1]}>{statusOf(x)[0]}</span></td>
                <td><a className="lnk" onClick={() => { store.set('mb_active', x.id); go('tracking'); }}>Track</a></td></tr>
            ))}
            <tr><td><b>#CB-1192</b></td><td>Sample record</td><td>Sunita Sharma</td><td>Metro Trauma Centre</td><td><span className="badge declared">Trauma</span></td><td><span className="badge simulated">Discharged</span></td><td></td></tr>
          </tbody></table></div>
      </div>
    </>
  );
}
