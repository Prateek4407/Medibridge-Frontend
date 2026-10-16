import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context.jsx';
import { Field } from './ui.jsx';
import {
  ACCEPT, CATEGORY, DOC_TYPES, MAX_MB, checkFile, downloadDoc, fileTag, fmtSize,
  isImage, isPdf, isText, normDoc, typeLabel,
} from '../lib/documents.js';
import { fmtTime } from '../lib/data.js';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/hooks.js';

/* tells other components (e.g. the "Medical history needed" badge) that documents changed */
const notifyDocsChanged = () => window.dispatchEvent(new Event('mb-docs-changed'));

/* ---------- preview modal (used by patient AND doctor) ---------- */
function ViewDocModal({ doc, closeModal }) {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const { toast } = useApp();
  useEffect(() => {
    let u = '', dead = false;
    /* the file needs the login token, so it is fetched as a blob and shown from a temporary local URL */
    api.blob('/documents/' + doc.id + '/file').then(async (blob) => {
      if (dead) return;
      u = URL.createObjectURL(blob); setUrl(u);
      if (isText(doc)) setText(await blob.text());
    }).catch((e) => { if (!dead) setErr(e.message); });
    return () => { dead = true; if (u) URL.revokeObjectURL(u); };
  }, [doc.id]); // eslint-disable-line

  return (
    <>
      <h3>{doc.title || doc.fileName}</h3>
      <p className="small muted" style={{ marginBottom: 12 }}>
        {typeLabel(doc.type)} &bull; {doc.fileName} &bull; {fmtSize(doc.size)} &bull; uploaded {fmtTime(doc.uploadedAt)} by {doc.ownerName}
      </p>
      {doc.note && <p className="small" style={{ marginBottom: 12 }}><b>Note:</b> {doc.note}</p>}
      {err && <p className="err">{err}</p>}
      {url && isImage(doc) && <img className="preview-img" src={url} alt={doc.fileName} />}
      {url && isPdf(doc) && <iframe className="preview" src={url} title={doc.fileName} />}
      {isText(doc) && <pre className="preview" style={{ overflow: 'auto', padding: 12, whiteSpace: 'pre-wrap', margin: 0 }}>{text}</pre>}
      {!isImage(doc) && !isPdf(doc) && !isText(doc) && (
        <p className="muted">A preview is not available for this file type. Use Download to open it.</p>
      )}
      <div className="acts">
        <button className="b-out" onClick={() => downloadDoc(doc).catch((e) => toast(e.message))}>Download</button>
        <button className="b-primary" onClick={closeModal}>Close</button>
      </div>
    </>
  );
}

/* =====================================================================
   PATIENT: upload documents + medical history
   ===================================================================== */
export function PatientDocuments() {
  const { toast, openModal, closeModal } = useApp();
  const { data, error, loading, reload } = useFetch(() => api.get('/documents'), []);
  const mine = useMemo(() => (data ? data.data.documents.map(normDoc) : []), [data]);
  /* is sharing with doctors switched on? (changed in the consent panel below) */
  const cq = useFetch(() => api.get('/consent'), []);
  useEffect(() => { const r = () => cq.reload(); window.addEventListener('mb-consent-changed', r); return () => window.removeEventListener('mb-consent-changed', r); }, [cq.reload]); // eslint-disable-line
  const shared = cq.data ? cq.data.data.documents.granted : true;
  const hasHistory = mine.some((d) => d.type === 'history');

  const [type, setType] = useState('history');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState([]);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef();
  const typeSet = useRef(false);

  /* once the list is loaded, default to "lab report" if medical history is already uploaded */
  useEffect(() => { if (data && !typeSet.current) { typeSet.current = true; if (hasHistory) setType('lab'); } }, [data]); // eslint-disable-line

  function addFiles(list) {
    const picked = [...list];
    const problems = picked.map(checkFile).filter(Boolean);
    const good = picked.filter((f) => !checkFile(f));
    setErr(problems.join(' '));
    setFiles((cur) => [...cur, ...good]);
  }

  async function upload(e) {
    e.preventDefault();
    if (!files.length) { setErr('Please choose at least one file to upload.'); return; }
    setBusy(true); setErr('');
    const failed = [];
    let ok = 0;
    for (const f of files) {
      const form = new FormData();
      form.append('category', CATEGORY[type]);
      form.append('note', note.trim());
      form.append('file', f);
      try { await api.post('/documents', { form }); ok++; } catch (ex) { failed.push(f.name + ': ' + ex.message); }
    }
    if (ok) {
      toast(ok + (ok > 1 ? ' documents' : ' document') + ' uploaded.' + (shared ? ' Doctors can now see ' + (ok > 1 ? 'them.' : 'it.') : ' Sharing with doctors is off.'));
      reload(); notifyDocsChanged();
      if (type === 'history') setType('lab');
    }
    setErr(failed.join(' '));
    setFiles(failed.length ? files.filter((f) => failed.some((m) => m.startsWith(f.name + ':'))) : []);
    if (!failed.length) setNote('');
    if (inputRef.current) inputRef.current.value = '';
    setBusy(false);
  }

  async function remove(d) {
    try { await api.del('/documents/' + d.id); toast('Document deleted'); reload(); notifyDocsChanged(); }
    catch (ex) { toast(ex.message); }
  }

  return (
    <>
    <div className="card" id="documents" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h3>My medical documents</h3>
        <span className={'badge ' + (shared ? 'declared' : 'estimated')}>{shared ? 'Visible to doctors' : 'Hidden from doctors'}</span>
      </div>
      <p className="small muted" style={{ marginBottom: 14 }}>
        Upload your medical history and any reports. {shared ? 'Doctors on MediBridge can open them from their dashboard.' : 'Sharing is switched off, so doctors cannot open them.'} Files are stored in the MediBridge database, not on the web server's disk, so they survive redeployments.
      </p>

      {hasHistory ? (
        <div className="docprompt ok"><span>&#10003;</span><div><b>Medical history uploaded</b>Thank you. You can add more reports below at any time.</div></div>
      ) : (
        <div className="docprompt"><span>&#9888;</span><div><b>Please upload your medical history document</b>Past illnesses, surgeries, allergies and current medicines help doctors treat you faster in an emergency.</div></div>
      )}

      <div className="tiles" style={{ marginBottom: 16 }}>
        <div><small>Medical history</small><b style={{ color: hasHistory ? '#047857' : '#b45309' }}>{hasHistory ? 'Uploaded' : 'Required'}</b></div>
        <div><small>Other documents</small><b>{mine.filter((d) => d.type !== 'history').length} uploaded</b></div>
        <div><small>Shared with</small><b>{shared ? 'Doctors on MediBridge' : 'Nobody (sharing off)'}</b></div>
      </div>

      <form onSubmit={upload} noValidate>
        <div className="row2">
          <Field label="Document type" htmlFor="docType">
            <select id="docType" value={type} onChange={(e) => setType(e.target.value)}>
              {DOC_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}{t.v === 'history' ? ' (required)' : ''}</option>)}
            </select>
          </Field>
          <Field label="Note for the doctor (optional)" htmlFor="docNote">
            <input id="docNote" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Diabetes since 2018, allergic to penicillin" />
          </Field>
        </div>

        <div
          className={'dropzone' + (over ? ' over' : '')}
          onClick={() => inputRef.current && inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current && inputRef.current.click(); } }}
        >
          <b>Click to choose files or drag &amp; drop them here</b>
          <small>PDF, JPG, PNG, Word or text &bull; up to {MAX_MB} MB each</small>
          <input ref={inputRef} type="file" multiple accept={ACCEPT} aria-label="Choose documents"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </div>

        {files.length > 0 && (
          <div className="filechips">
            {files.map((f, i) => (
              <span className="filechip" key={f.name + i}>{f.name} <span className="muted">({fmtSize(f.size)})</span>
                <button type="button" aria-label={'Remove ' + f.name} onClick={() => setFiles(files.filter((_, j) => j !== i))}>&times;</button>
              </span>
            ))}
          </div>
        )}

        <p className="err" style={{ marginTop: 10 }}>{err}</p>
        <button className="b-primary" type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Upload ' + (type === 'history' ? 'medical history' : 'document') + (files.length > 1 ? 's' : '')}</button>
      </form>

      <h3 style={{ marginTop: 22, fontSize: 15 }}>Uploaded files ({mine.length})</h3>
      <ul className="list">
        {mine.length ? mine.map((d) => (
          <li key={d.id}>
            <span className="docitem">
              <span className="ftype">{fileTag(d.fileName)}</span>
              <span>
                <b>{d.fileName}</b>
                <small className="muted">{typeLabel(d.type)} &bull; {fmtSize(d.size)} &bull; {fmtTime(d.uploadedAt)}{d.note ? ' \u2022 ' + d.note : ''}</small>
              </span>
            </span>
            <span className="docacts">
              {d.type === 'history' && <span className="badge green">History</span>}
              <button className="b-out b-sm" onClick={() => openModal(<ViewDocModal doc={d} closeModal={closeModal} />, { wide: true })}>View</button>
              <button className="b-out b-sm" onClick={() => downloadDoc(d).catch((e) => toast(e.message))}>Download</button>
              <button className="b-out b-sm" onClick={() => remove(d)}>Delete</button>
            </span>
          </li>
        )) : <li className="muted">{loading ? 'Loading your documents…' : error ? error.message : 'No documents yet. Start with your medical history above.'}</li>}
      </ul>
    </div>
    <ConsentAndAudit />
    </>
  );
}

/* ---------- shared audit helpers ---------- */
const ACTION_TEXT = {
  'document.upload': 'uploaded', 'document.view': 'opened', 'document.download': 'downloaded', 'document.delete': 'deleted',
  'document.denied': 'tried to open (blocked, no consent)', 'consent.grant': 'allowed doctors to open your documents', 'consent.withdraw': 'withdrew doctor access to your documents',
};
const ACTION_BADGE = { 'document.denied': 'red', 'consent.withdraw': 'estimated', 'consent.grant': 'green' };
const SCOPE_TEXT = { documents: 'Doctor access to my medical documents', 'emergency-case': 'Emergency request: share details with hospital & ambulance team' };

/* =====================================================================
   PATIENT: consent control + who opened my records
   ===================================================================== */
function ConsentAndAudit() {
  const { toast } = useApp();
  const consent = useFetch(() => api.get('/consent'), []);
  const log = useFetch(() => api.get('/audit?limit=100'), [], { interval: 10000 });
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('access');
  const granted = consent.data ? consent.data.data.documents.granted : true;
  const history = consent.data ? consent.data.data.history : [];
  const events = log.data ? log.data.data.events : [];
  const access = events.filter((e) => e.action === 'document.view' || e.action === 'document.download' || e.action === 'document.denied');

  async function change(next) {
    if (!next && !window.confirm('Doctors will not be able to open any of your documents until you allow it again. Continue?')) return;
    setBusy(true);
    try { const r = await api.post('/consent', { body: { granted: next } }); toast(r.message); consent.reload(); log.reload(); window.dispatchEvent(new Event('mb-consent-changed')); }
    catch (ex) { toast(ex.message); }
    setBusy(false);
  }

  return (
    <div className="card" id="consent" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h3>Consent &amp; access history</h3>
        <span className={'badge ' + (granted ? 'green' : 'estimated')}>{granted ? 'Doctors can open my documents' : 'Sharing is off'}</span>
      </div>
      <p className="small muted" style={{ marginBottom: 14 }}>You decide whether doctors can open your documents. Every time a doctor opens or downloads one, it is recorded here. Entries cannot be edited or deleted.</p>

      <div className="consentbox">
        <div>
          <b>{granted ? 'Sharing with doctors is ON' : 'Sharing with doctors is OFF'}</b>
          <small className="muted">{granted ? 'Turn it off to hide all your documents from doctors. Your own access is not affected.' : 'Doctors cannot see or open your documents. In a real emergency, call 112 / 102 and tell the crew your history.'}</small>
        </div>
        <button className={granted ? 'b-out' : 'b-primary'} disabled={busy || consent.loading} onClick={() => change(!granted)}>{granted ? 'Withdraw consent' : 'Allow doctors again'}</button>
      </div>

      <div className="tabs-a" style={{ marginBottom: 10 }}>
        <button className={tab === 'access' ? 'on' : ''} onClick={() => setTab('access')}>Who opened my records ({access.length})</button>
        <button className={tab === 'consent' ? 'on' : ''} onClick={() => setTab('consent')}>My consent decisions ({history.length})</button>
      </div>

      {tab === 'access' ? (
        <ul className="list">
          {access.length ? access.map((e) => (
            <li key={e.id}>
              <span className="logrow"><span className={'badge ' + (ACTION_BADGE[e.action] || 'declared')}>{e.actorRole === 'doctor' ? 'Doctor' : 'You'}</span>
                <b style={{ display: 'inline' }}>{e.actorName}</b> {ACTION_TEXT[e.action]} <b style={{ display: 'inline' }}>{e.targetLabel}</b></span>
              <small className="muted">{fmtTime(e.createdAt)}</small>
            </li>
          )) : <li className="muted">{log.loading && !log.data ? 'Loading…' : log.error ? log.error.message : 'Nobody has opened your documents yet.'}</li>}
        </ul>
      ) : (
        <ul className="list">
          {history.length ? history.map((h) => (
            <li key={h.id}>
              <span className="logrow"><span className={'badge ' + (h.granted ? 'green' : 'estimated')}>{h.granted ? 'Allowed' : 'Withdrawn'}</span>
                {SCOPE_TEXT[h.scope] || h.scope}{h.caseId ? ' (' + h.caseId + ')' : ''}</span>
              <small className="muted">{fmtTime(h.createdAt)}</small>
            </li>
          )) : <li className="muted">{consent.loading && !consent.data ? 'Loading…' : 'No decisions recorded yet. Your first upload records that you allow doctors to see it.'}</li>}
        </ul>
      )}
    </div>
  );
}

/* =====================================================================
   DOCTOR: read-only access to every patient's documents
   ===================================================================== */
export function DoctorDocuments() {
  const { toast, openModal, closeModal } = useApp();
  const [who, setWho] = useState('all');
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  useEffect(() => { const t = setTimeout(() => setDq(q), 250); return () => clearTimeout(t); }, [q]);

  const pats = useFetch(() => api.get('/documents/patients'), [], { interval: 8000 });
  const patients = pats.data ? pats.data.data.patients : [];
  const totalFiles = patients.reduce((n, p) => n + p.documents, 0);

  const docsQ = useFetch(() => {
    const qs = new URLSearchParams();
    if (who !== 'all') qs.set('patientId', who);
    if (kind !== 'all') qs.set('category', CATEGORY[kind]);
    if (dq) qs.set('q', dq);
    return api.get('/documents?' + qs.toString());
  }, [who, kind, dq], { interval: 8000 });
  const rows = docsQ.data ? docsQ.data.data.documents.map(normDoc) : [];
  const noneAtAll = totalFiles === 0;

  return (
    <div className="card" id="docDocuments">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h3>Patient documents</h3>
        <span className="badge declared">{totalFiles} file{totalFiles === 1 ? '' : 's'} &bull; {patients.length} patient{patients.length === 1 ? '' : 's'}</span>
      </div>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Medical history and reports uploaded by patients. Open or download them before a consultation or an incoming case.
      </p>

      <div className="sbox three">
        <div>
          <label htmlFor="dcPatient">Patient</label>
          <select id="dcPatient" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="all">All patients</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.documents}){p.hasMedicalHistory ? '' : ' - no history'}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="dcType">Type</label>
          <select id="dcType" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">All types</option>
            {DOC_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label.split(' (')[0]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="dcSearch">Search</label>
          <input id="dcSearch" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="File, patient or note" />
        </div>
      </div>

      <div className="tblwrap">
        <table className="tbl">
          <thead><tr><th>Patient</th><th>Document</th><th>Type</th><th>Size</th><th>Uploaded</th><th></th></tr></thead>
          <tbody>
            {rows.length ? rows.map((d) => (
              <tr key={d.id}>
                <td><b>{d.ownerName}</b></td>
                <td>{d.fileName}{d.note && <><br /><small className="muted">{d.note}</small></>}</td>
                <td><span className={'badge ' + (d.type === 'history' ? 'green' : 'declared')}>{typeLabel(d.type)}</span></td>
                <td>{fmtSize(d.size)}</td>
                <td>{fmtTime(d.uploadedAt)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <a className="lnk" onClick={() => openModal(<ViewDocModal doc={d} closeModal={closeModal} />, { wide: true })}>View</a>
                  {' \u00b7 '}
                  <a className="lnk" onClick={() => downloadDoc(d).catch((e) => toast(e.message))}>Download</a>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="6" className="muted">{docsQ.error ? docsQ.error.message : docsQ.loading && !docsQ.data ? 'Loading documents…' : noneAtAll ? 'No documents yet. Files that patients upload from their dashboard will appear here.' : 'No documents match these filters.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* DOCTOR: my own recent document activity (what I opened, and any blocked attempts) */
export function DoctorActivity() {
  const log = useFetch(() => api.get('/audit?limit=20'), [], { interval: 15000 });
  const events = log.data ? log.data.data.events : [];
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <h3>My recent document activity</h3>
      <p className="small muted" style={{ marginBottom: 10 }}>Patients can see these entries. Documents of patients who withdrew consent are hidden and attempts to open them are logged.</p>
      <ul className="list">
        {events.length ? events.map((e) => (
          <li key={e.id}>
            <span className="logrow"><span className={'badge ' + (ACTION_BADGE[e.action] || 'declared')}>{e.action === 'document.denied' ? 'Blocked' : 'Logged'}</span>
              You {ACTION_TEXT[e.action]} <b style={{ display: 'inline' }}>{e.targetLabel}</b> <small>({e.patientName})</small></span>
            <small className="muted">{fmtTime(e.createdAt)}</small>
          </li>
        )) : <li className="muted">{log.loading && !log.data ? 'Loading…' : log.error ? log.error.message : 'No activity yet.'}</li>}
      </ul>
    </div>
  );
}

/* small helper used by the patient hero to show a reminder (refreshes after every upload / delete) */
export function useNeedsHistory() {
  const { data, reload } = useFetch(() => api.get('/documents/summary'), []);
  const refresh = useCallback(() => reload(), [reload]);
  useEffect(() => {
    window.addEventListener('mb-docs-changed', refresh);
    return () => window.removeEventListener('mb-docs-changed', refresh);
  }, [refresh]);
  return data ? !data.data.hasMedicalHistory : false;
}
