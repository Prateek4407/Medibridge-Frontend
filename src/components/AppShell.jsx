import React, { useEffect } from 'react';
import { useStore } from '../lib/store.js';
import { clearAuth } from '../lib/api.js';
import { useApp, go } from '../context.jsx';
import Login from '../pages/Login.jsx';
import Register from '../pages/Register.jsx';
import Finder from '../pages/Finder.jsx';
import Request from '../pages/Request.jsx';
import Tracking from '../pages/Tracking.jsx';
import Patient from '../pages/Patient.jsx';
import Doctor from '../pages/Doctor.jsx';
import DelayPredict from '../pages/DelayPredict.jsx';
import Driver from '../pages/Driver.jsx';
import Admin from '../pages/Admin.jsx';

import { ROUTES } from '../lib/routes.js';
const PAGES = { login: Login, register: Register, finder: Finder, request: Request, tracking: Tracking, patient: Patient, doctor: Doctor, delay: DelayPredict, driver: Driver, admin: Admin };

const ROLE_LABEL = { patient: 'Patient', doctor: 'Doctor', driver: 'Driver', admin: 'Administrator' };

function AuthBox({ session }) {
  const { toast } = useApp();
  if (!session) {
    return <div id="authBox"><a className="b-out" href="#/login">Login</a> <a className="b-primary" href="#/register">Register</a></div>;
  }
  return (
    <div id="authBox">
      <div className="userchip">
        <div className="avatar">{session.name.charAt(0).toUpperCase()}</div>
        <div><b>{session.name}</b><small>{ROLE_LABEL[session.role] || 'Patient'} &bull; {session.role === 'doctor' ? 'Clinical console' : session.role === 'driver' ? 'Ambulance crew' : session.role === 'admin' ? 'Approvals' : 'Portal'}</small></div>
        <button className="b-out b-sm" onClick={() => { window.location.hash = '#/home'; clearAuth(); toast('Logged out'); }}>Logout</button>
      </div>
    </div>
  );
}

function Sidebar({ session, current }) {
  const { pendingScroll } = useApp();
  let title, items;
  if (!session) {
    title = 'Get help';
    items = [['finder', 'Hospital Finder'], ['request', 'Emergency Request'], ['delay', 'Response Delay Prediction'], ['tracking', 'Live Tracking'], ['login', 'Login'], ['register', 'Register']];
  } else if (session.role === 'patient') {
    title = 'Patient care journey';
    items = [['patient', 'Patient Dashboard'], ['request', 'Emergency Request'], ['finder', 'Hospital Finder'], ['delay', 'Response Delay Prediction'], ['tracking', 'Live Tracking'],
      ['patient', 'My Documents', 'documents'], ['patient', 'Appointments', 'appointments'], ['patient', 'Payments', 'payments']];
  } else if (session.role === 'admin') {
    title = 'Administration';
    items = [['admin', 'Doctor & driver approvals'], ['finder', 'Hospital Finder']];
  } else if (session.role === 'driver') {
    title = 'Ambulance crew';
    items = [['driver', 'My Ambulance'], ['finder', 'Hospital Finder'], ['tracking', 'Live Tracking']];
  } else {
    title = 'Doctor console';
    items = [['doctor', 'Doctor Dashboard'], ['doctor', 'Patient Details', 'docPatients'], ['doctor', 'Patient Documents', 'docDocuments'], ['doctor', 'Ambulances', 'ambulances'],
      ['doctor', 'Time Scheduling', 'scheduling'], ['finder', 'Hospital Finder'], ['delay', 'Response Delay Prediction'], ['tracking', 'Live Tracking']];
  }
  const scrollTo = (e, sc, to) => {
    e.preventDefault();
    if (current === to) { const el = document.getElementById(sc); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else { pendingScroll.current = sc; go(to); }
  };
  return (
    <aside className="a-side" id="side">
      <h4>{title}</h4>
      {items.map(([r, label, sc]) => sc
        ? <a key={label} href={'#/' + r} onClick={(e) => scrollTo(e, sc, r)}>{label}</a>
        : <a key={label} className={current === r ? 'on' : ''} href={'#/' + r}>{label}</a>)}
      <a href="#/home">&larr; Main Dashboard</a>
      <div className="pipe">Triage pipeline <b>READY</b></div>
    </aside>
  );
}

export default function AppShell({ name }) {
  const session = useStore('mb_session', null);
  const { modal, closeModal, toastMsg, toastOn, pendingScroll } = useApp();
  const Page = PAGES[name];

  useEffect(() => {
    document.title = 'MediBridge | ' + name.charAt(0).toUpperCase() + name.slice(1);
    window.scrollTo(0, 0);
    if (pendingScroll.current) {
      const t = pendingScroll.current; pendingScroll.current = null;
      setTimeout(() => { const el = document.getElementById(t); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    }
  }, [name]); // eslint-disable-line

  return (
    <div className={'app' + (ROUTES[name].side === false ? ' nosidebar' : '')} id="app">
      <div className="a-strip">
        <span><b>FOR IMMEDIATE THREAT TO LIFE:</b> Dial 112 or 102 immediately. MediBridge is a coordination &amp; triage prototype.</span>
        <a className="callbtn" href="tel:112">Instant Call 112 / 102</a>
      </div>
      <header className="a-head">
        <a href="#/home" className="a-logo"><i>&#10010;</i>Medi<b>Bridge</b></a>
        <span className="tagchip">Delhi NCR Prototype (Simulated)</span>
        <span className="tagchip warn">&#9679; Simulated Environment &bull; No Live Dispatch</span>
        <div className="a-spacer"></div>
        <a href="#/request" className="b-red">SOS &nbsp;Request Emergency Help</a>
        <AuthBox session={session} />
      </header>
      <div className="a-body">
        <Sidebar session={session} current={name} />
        <main className="a-main">
          <div className="page show" key={name}><Page /></div>
        </main>
      </div>

      {modal && (
        <div className="modal-back" id="modal" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className={'modal' + (modal.wide ? ' wide' : '')} id="modalBox">{modal.node}</div>
        </div>
      )}
      <div className={'toast' + (toastOn ? ' show' : '')} id="toast">{toastMsg}</div>
    </div>
  );
}
