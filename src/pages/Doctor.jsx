import React, { useState } from 'react';
import { useStore } from '../lib/store.js';
import { useApp } from '../context.jsx';
import { SAMPLE_PATIENTS, statusOf, ymd } from '../lib/data.js';
import { api, normCase } from '../lib/api.js';
import { useFetch } from '../lib/hooks.js';
import { Field } from '../components/ui.jsx';
import { DoctorDocuments, DoctorActivity } from '../components/Documents.jsx';
import { AmbulanceManager } from '../components/Ambulances.jsx';

function PatientModal({ p, closeModal }) {
  return (
    <>
      <h3>Patient #{p.id}</h3>
      <div className="rows">
        <div><span>Name</span><b>{p.name}</b></div><div><span>Age / sex</span><b>{p.age} / {p.sex}</b></div><div><span>Category</span><b>{p.care}</b></div><div><span>Priority</span><b>{p.sev}</b></div>
        <div><span>Status</span><b>{p.status}</b></div><div><span>Pickup</span><b>{p.address}</b></div>
        {p.symptoms && <div><span>Symptoms</span><b>{p.symptoms}</b></div>}
        {p.phone && <div><span>Callback</span><b>+91 {p.phone}</b></div>}
        {p.hospital && <div><span>Hospital</span><b>{p.hospital}</b></div>}
      </div>
      <div className="acts"><button className="b-primary" onClick={closeModal}>Close</button></div>
    </>
  );
}

export default function Doctor() {
  const { toast, openModal, closeModal } = useApp();
  const s = useStore('mb_session', null);
  const [form, setForm] = useState({ date: '', from: '', to: '', note: '' });
  const [err, setErr] = useState('');

  const casesQ = useFetch(() => api.get('/cases'), [], { interval: 4000 });
  const activeQ = useFetch(() => api.get('/cases/active'), [], { interval: 4000 });
  const slotsQ = useFetch(() => api.get('/slots'), []);

  const cases = casesQ.data ? casesQ.data.data.cases.map(normCase) : [];
  const c = activeQ.data ? normCase(activeQ.data.data.case) : null;
  const slots = slotsQ.data ? slotsQ.data.data.slots : [];
  const netErr = [casesQ, activeQ, slotsQ].map((x) => x.error).find((e) => e && e.status === 0);
  const patients = cases.map((x) => ({ id: x.id, name: x.name, age: x.age, sex: x.sex, care: x.care, sev: x.sev, status: statusOf(x)[0], address: x.address, symptoms: x.symptoms, phone: x.phone, hospital: x.hospital.name })).concat(SAMPLE_PATIENTS);
  const setF = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const saveSlot = async (e) => {
    e.preventDefault();
    const { date, from, to } = form;
    if (!date || !from || !to) { setErr('Please choose a date and both times.'); return; }
    if (date < ymd(0)) { setErr('The date cannot be in the past.'); return; }
    if (from >= to) { setErr('The end time must be after the start time.'); return; }
    try {
      const r = await api.post('/slots', { body: { date, from, to, note: form.note.trim() } });
      setErr(''); setForm({ date: '', from: '', to: '', note: '' });
      toast(r.message || 'Schedule saved. Patients can now book it.');
      slotsQ.reload();
    } catch (ex) { setErr(ex.message); }
  };
  const deleteSlot = async (id) => { try { await api.del('/slots/' + id); toast('Slot deleted'); } catch (e) { toast(e.message); } slotsQ.reload(); };
  const acknowledge = async () => {
    try { const r = await api.post('/cases/' + c.id + '/acknowledge'); toast(r.message || 'Readiness acknowledged'); activeQ.reload(); } catch (e) { toast(e.message); }
  };

  return (
    <>
      {netErr && <div className="docprompt" style={{ marginBottom: 14 }}><span>&#9888;</span><div><b>Cannot reach the server</b>{netErr.message}</div></div>}
      <div className="card hero-a">
        <div><span className="badge declared">Doctor account</span>
          <h1 style={{ marginTop: 8 }}>{s.name}</h1>
          <p className="muted">{s.spec || 'Emergency medicine'} &bull; Doctor console</p></div>
        <span className="badge simulated">Simulated clinical environment</span>
      </div>

      <div id="dIncoming">
        {c && c.stage < 5 && (() => {
          const h = c.hospital;
          return (
            <div className="casehead" style={{ marginBottom: 20 }}>
              <div><span className={'code ' + c.sev.toLowerCase()}>{c.sev}</span> <span className="caseid">Incoming #{c.id}</span><h3 style={{ marginTop: 6 }}>{c.name}, {c.age} ({c.sex})</h3><small>{c.care} &bull; arriving at {h.name}</small></div>
              <div style={{ textAlign: 'right' }}><small>Stage</small><div className="eta">{c.stage + 1} / 6</div>{c.acknowledgedAt
                ? <span className="badge green" style={{ marginTop: 6 }}>Readiness acknowledged</span>
                : <button className="b-primary b-sm" style={{ marginTop: 6 }} onClick={acknowledge}>Acknowledge readiness</button>}</div>
            </div>
          );
        })()}
      </div>

      <div className="g2-wide">
        <div className="card" id="docPatients">
          <h3>Patient details</h3>
          <p className="small muted" style={{ marginBottom: 8 }}>Emergency cases received by MediBridge plus sample records.</p>
          <div className="tblwrap"><table className="tbl"><thead><tr><th>Case</th><th>Patient</th><th>Age / Sex</th><th>Category</th><th>Priority</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}><td><b>#{p.id}</b></td><td>{p.name}</td><td>{p.age} / {p.sex}</td><td><span className="badge declared">{p.care}</span></td>
                  <td><span className={'badge ' + (p.sev === 'P1' ? 'red' : p.sev === 'P2' ? 'estimated' : 'simulated')}>{p.sev}</span></td><td>{p.status}</td>
                  <td><a className="lnk" onClick={() => openModal(<PatientModal p={p} closeModal={closeModal} />)}>View details</a></td></tr>
              ))}
            </tbody></table></div>
        </div>
        <div className="card" id="scheduling">
          <h3>Time scheduling</h3>
          <p className="small muted" style={{ marginBottom: 12 }}>Saved slots appear in each patient's "My appointments".</p>
          <form onSubmit={saveSlot} noValidate>
            <Field label="Date" htmlFor="sDate"><input id="sDate" type="date" min={ymd(0)} value={form.date} onChange={setF('date')} /></Field>
            <div className="row2">
              <Field label="From" htmlFor="sFrom"><input id="sFrom" type="time" value={form.from} onChange={setF('from')} /></Field>
              <Field label="To" htmlFor="sTo"><input id="sTo" type="time" value={form.to} onChange={setF('to')} /></Field>
            </div>
            <Field label="Note (optional)" htmlFor="sNote"><input id="sNote" type="text" placeholder="e.g. Follow-up consultation" value={form.note} onChange={setF('note')} /></Field>
            <p className="err">{err}</p>
            <button className="b-primary wide" type="submit">Save schedule</button>
          </form>
          <h3 style={{ marginTop: 20, fontSize: 15 }}>My saved slots</h3>
          <ul className="list">
            {slots.length ? slots.map((x) => (
              <li key={x.id}><span><b>{x.date} &bull; {x.from} to {x.to}</b><small className="muted">{x.status === 'booked' ? 'Booked by ' + x.bookedBy : 'Free'}{x.note ? ' \u2022 ' + x.note : ''}</small></span>
                <button className="b-out b-sm" onClick={() => deleteSlot(x.id)}>Delete</button></li>
            )) : <li className="muted">{slotsQ.loading ? 'Loading…' : 'No slots saved yet.'}</li>}
          </ul>
        </div>
      </div>

      {/* NEW: documents uploaded by patients */}
      <DoctorDocuments />
      <DoctorActivity />

      {/* NEW: ambulance fleet management */}
      <AmbulanceManager />
    </>
  );
}
