import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

/* ---------- Smart-match demo data (illustrative) ---------- */
const MATCH_HOSPITALS = [
  { n: 'Riverside Heart Institute', km: 3.2, cap: 80, load: 35, s: ['Cardiac', 'Emergency'] },
  { n: 'City General Hospital', km: 1.8, cap: 60, load: 70, s: ['Trauma', 'Emergency', 'Cardiac'] },
  { n: 'Lotus Women & Child Care', km: 4.5, cap: 90, load: 25, s: ['Maternity', 'Emergency'] },
  { n: 'Metro Trauma Centre', km: 2.6, cap: 55, load: 60, s: ['Trauma', 'Emergency'] },
  { n: 'Sunrise Multispeciality', km: 5.9, cap: 85, load: 30, s: ['Cardiac', 'Maternity', 'Trauma', 'Emergency'] },
  { n: 'Green Park Clinic', km: 1.2, cap: 40, load: 50, s: ['Emergency', 'Maternity'] },
];
const CATS = ['Emergency', 'Cardiac', 'Trauma', 'Maternity'];
const score = (h) => Math.round(Math.max(0, 100 - h.km * 12) * 0.4 + h.cap * 0.3 + (100 - h.load) * 0.3);

const SIM_STEPS = [
  ['Request', 'Patient request received'],
  ['Validate', 'Location confirmed, case ID CB-2041 created'],
  ['Match', 'Best-fit hospital shortlisted'],
  ['Ambulance', 'Ambulance requested, arrival time estimated'],
  ['Confirm', 'Hospital and ambulance acknowledged'],
  ['Handoff', 'Patient handed over at hospital'],
];

const ROLES = {
  Patient: { t: 'Patient & Caregiver', p: 'A calm, guided request that takes seconds, then a live view of everything happening.',
    l: ['Guided request with location and service', 'Consent and contact in one place', 'Live case tracking'],
    ui: [['Case CB-2041', 'Active'], ['Ambulance arrival', '8 min'], ['Hospital', 'Confirmed']] },
  Hospital: { t: 'Hospital Team', p: 'Incoming cases arrive in an organised queue, so staff can prepare before the patient arrives.',
    l: ['Request queue with clear priority', 'Acknowledge and assign a doctor', 'Share service status and preparation notes'],
    ui: [['Incoming: Cardiac', 'New'], ['Doctor assigned', 'Dr. on call'], ['Bed prepared', 'Ready']] },
  Ambulance: { t: 'Ambulance Operator', p: 'A simple assignment screen with the route, arrival time and milestones to tap.',
    l: ['Vehicle status and assignment', 'Route and arrival estimate', 'Pickup and arrival milestones'],
    ui: [['Vehicle', 'Available'], ['Pickup route', '4.1 km'], ['Mark pickup', 'Tap']] },
  Coordinator: { t: 'Coordinator', p: 'A control-room view of every active case, with shortlists and exceptions flagged early.',
    l: ['Overview of all active cases', 'Hospital shortlist and assignment', 'Exceptions and communication'],
    ui: [['Active cases', '12'], ['Needs attention', '2'], ['Avg. response', 'On track']] },
  Admin: { t: 'Administrator', p: 'Keeps the platform healthy: facilities, people, access and reports in one console.',
    l: ['Facility records and user roles', 'Activity logs and audit history', 'Reports and system settings'],
    ui: [['Facilities', 'Updated'], ['Roles', 'Managed'], ['Reports', 'Export']] },
};

/* ---------- LIVE DEMO ---------- */
function LiveDemo() {
  const [on, setOn] = useState(-1);
  const [log, setLog] = useState(null);          // null = placeholder
  const [status, setStatus] = useState('Waiting for a request…');
  const [roadW, setRoadW] = useState(0);
  const roadRef = useRef(), logRef = useRef(), timers = useRef([]);

  useLayoutEffect(() => {
    const measure = () => setRoadW(roadRef.current.clientWidth - 140);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  const reset = () => { timers.current.forEach(clearTimeout); timers.current = []; setOn(-1); setLog(null); setStatus('Waiting for a request…'); };
  const start = () => {
    reset(); setLog([]); setStatus('Case in progress…');
    SIM_STEPS.forEach((s, i) => {
      timers.current.push(setTimeout(() => {
        setOn(i);
        const t = '00:' + String(i * 40 + (i ? 5 : 0)).padStart(2, '0');
        setLog((l) => [...(l || []), { t, text: s[1] }]);
        if (i === SIM_STEPS.length - 1) setStatus('✔ Case complete: patient safely handed over');
      }, i * 1300));
    });
  };
  const p = on < 0 ? 0 : on / (SIM_STEPS.length - 1);

  return (
    <div className="sim reveal">
      <div className="simbar">
        <button className="btn p" onClick={start}>▶ Start emergency request</button>
        <button className="btn g" onClick={reset} style={{ color: 'var(--ink2)', borderColor: 'var(--line)' }}>Reset</button>
        <span>{status}</span>
      </div>
      <div className="road" ref={roadRef}>
        <div className="endpoint l"><span>📍</span>Patient</div>
        <div className="line"></div><div className="fill" style={{ width: roadW * p + 'px' }}></div>
        <div className="amb" style={{ left: 70 + roadW * p - (p > 0 ? 4 : 0) + 'px' }}>🚑</div>
        <div className="endpoint r"><span>🏥</span>Hospital</div>
      </div>
      <div className="stages">
        {SIM_STEPS.map((s, i) => <div key={s[0]} className={'stage' + (i <= on ? ' on' : '')}><i>{i + 1}</i><b>{s[0]}</b></div>)}
      </div>
      <div className="log" ref={logRef}>
        {log === null ? <div><time>--:--</time>Case timeline will appear here.</div> : log.map((l, i) => <div key={i}><time>{l.t}</time>{l.text}</div>)}
      </div>
    </div>
  );
}

/* ---------- SMART MATCH ---------- */
function SmartMatch() {
  const [cat, setCat] = useState('Cardiac');
  const list = MATCH_HOSPITALS.filter((h) => h.s.includes(cat)).map((h) => ({ ...h, sc: score(h) })).sort((a, b) => b.sc - a.sc);
  return (
    <>
      <div className="chips reveal">{CATS.map((c) => <button key={c} className={'chip' + (c === cat ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>)}</div>
      <div className="hosp">
        {list.map((h, i) => (
          <div className="h" key={h.n}><div className="rank">{i + 1}</div>
            <div><b>{h.n}</b><small>{h.km} km away &middot; {h.s.join(', ')}</small></div>
            <div className="bars">
              <div className="bar"><u>Closeness</u><div><i style={{ width: Math.max(0, 100 - h.km * 12) + '%' }}></i></div></div>
              <div className="bar"><u>Available</u><div><i style={{ width: h.cap + '%' }}></i></div></div>
              <div className="bar"><u>Low load</u><div><i style={{ width: 100 - h.load + '%' }}></i></div></div>
            </div>
            <div className="score">{h.sc}<small>/100</small></div></div>
        ))}
      </div>
    </>
  );
}

/* ---------- ROLES ---------- */
function Roles() {
  const [k, setK] = useState('Patient');
  const r = ROLES[k];
  return (
    <>
      <div className="tabs reveal">{Object.keys(ROLES).map((x) => <button key={x} className={'tab' + (x === k ? ' on' : '')} onClick={() => setK(x)}>{x}</button>)}</div>
      <div className="panel reveal">
        <div><h3>{r.t}</h3><p>{r.p}</p><ul>{r.l.map((x) => <li key={x}>{x}</li>)}</ul></div>
        <div className="phone"><div className="top"><span>MediBridge</span><span>● Live</span></div>
          {r.ui.map((x, i) => <div className="row" key={x[0]}><b>{x[0]}</b><em className={i === 1 ? 'w' : ''}>{x[1]}</em></div>)}</div>
      </div>
    </>
  );
}

export default function Home() {
  const rootRef = useRef();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.title = 'MediBridge | One Bridge Between an Emergency and the Right Care';
    const h = window.location.hash;
    if (h.length > 1 && !h.startsWith('#/')) {
      const el = document.getElementById(h.slice(1)); if (el) el.scrollIntoView();
    } else window.scrollTo(0, 0);

    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll);

    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
    rootRef.current.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => { window.removeEventListener('scroll', onScroll); io.disconnect(); };
  }, []);

  const close = () => setOpen(false);

  return (
    <div id="view-home" ref={rootRef}>
      <nav id="nav" className={solid ? 'solid' : ''}>
        <div className="wrap">
          <a href="#top" className="logo"><i>✚</i>Medi<b>Bridge</b></a>
          <button className="burger" aria-label="Menu" onClick={() => setOpen(!open)}>&#9776;</button>
          <div className={'links' + (open ? ' open' : '')} onClick={(e) => { if (e.target.closest('a')) close(); }}>
            <a href="#gap">The Gap</a><a href="#live">Live Demo</a><a href="#match">Smart Match</a>
            <a href="#roles">Everyone</a><a href="#intel">Insight</a><a href="#pilot">Pilot</a>
            <a href="#/finder" className="navbtn">Find Hospital</a><a href="#/login" className="navbtn">Login</a><a href="#/request" className="navbtn em">Emergency</a>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="orb a"></div><div className="orb b"></div>
        <div className="wrap">
          <span className="pill">Emergency Care Coordination</span>
          <h1>One bridge between an emergency and <em>the right care.</em></h1>
          <p className="lead">MediBridge turns a frantic search for help into one coordinated, trackable journey, connecting the patient, hospital, doctor and ambulance in a single flow.</p>
          <div className="cta">
            <a href="#live" className="btn p">Watch a case unfold</a>
            <a href="#gap" className="btn g">Why MediBridge?</a>
          </div>
        </div>
        <svg className="pulse" viewBox="0 0 1200 110" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 60 H380 L410 60 L430 20 L460 100 L490 5 L520 60 H720 L745 60 L765 35 L790 85 L815 60 H1200" />
        </svg>
      </header>

      <section id="gap">
        <div className="wrap">
          <p className="kick reveal">The Gap</p>
          <h2 className="reveal">In an emergency, confusion costs time.</h2>
          <p className="sub reveal">Patients and caregivers call hospital after hospital, hunt for an ambulance, and repeat the same details again and again. MediBridge replaces that scramble with one clear path.</p>
          <div className="vs">
            <div className="col bad reveal">
              <h3>Today: scattered and stressful</h3>
              <ul>
                <li>Calling several hospitals one by one</li>
                <li>Searching separately for an ambulance</li>
                <li>Repeating the same information every time</li>
                <li>Waiting on disconnected replies</li>
                <li>No clear view of where the patient is in the journey</li>
              </ul>
            </div>
            <div className="col good reveal">
              <h3>With MediBridge: one connected case</h3>
              <ul>
                <li>One request, entered once</li>
                <li>Suitable hospitals shortlisted automatically</li>
                <li>Ambulance requested and its arrival time shown</li>
                <li>Hospital and ambulance confirm in real time</li>
                <li>A live timeline from home to hospital handoff</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="live" className="tint">
        <div className="wrap">
          <p className="kick reveal">Live Demo</p>
          <h2 className="reveal">Watch one case travel from request to handoff.</h2>
          <p className="sub reveal">Press the button to simulate how a single emergency request moves through six stages, with every step time-stamped.</p>
          <LiveDemo />
          <p className="note">Simulation for presentation purposes only.</p>
        </div>
      </section>

      <section id="match">
        <div className="wrap">
          <p className="kick reveal">Smart Matching</p>
          <h2 className="reveal">The right hospital, ranked and explained.</h2>
          <p className="sub reveal">Choose the type of care needed. MediBridge shortlists facilities that offer it, then ranks them by closeness, availability and how busy they are expected to be.</p>
          <SmartMatch />
          <p className="note">Hospital names and figures are illustrative demo data.</p>
        </div>
      </section>

      <section id="roles" className="dark">
        <div className="wrap">
          <p className="kick reveal">Built for everyone involved</p>
          <h2 className="reveal">Every participant sees exactly what they need.</h2>
          <p className="sub reveal">Five focused experiences, one shared case. Select a role to preview it.</p>
          <Roles />
        </div>
      </section>

      <section id="intel">
        <div className="wrap two">
          <div className="reveal">
            <p className="kick">Predictive Insight</p>
            <h2>Planning ahead, not just reacting.</h2>
            <p className="sub" style={{ marginBottom: 26 }}>MediBridge learns from past patterns to support faster, better-informed decisions. People stay in control; predictions guide, they never decide.</p>
            <div className="feat">
              <div><span>📈</span><div><h4>Hospital demand forecast</h4><p>Anticipates how busy a hospital or its ICU may be in the coming hours, so coordinators can plan early.</p></div></div>
              <div><span>⏱️</span><div><h4>Smarter arrival times</h4><p>Improves ambulance arrival estimates by learning from time of day, area and past trips.</p></div></div>
            </div>
          </div>
          <div className="card reveal chart-on" id="chartCard">
            <h3>Expected hospital load</h3>
            <svg viewBox="0 0 440 240" width="100%" role="img" aria-label="Illustrative forecast chart">
              <defs>
                <linearGradient id="gA" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#19c3b1" stopOpacity=".35" /><stop offset="1" stopColor="#19c3b1" stopOpacity="0" /></linearGradient>
              </defs>
              <g stroke="#e1edf0"><line x1="30" x2="430" y1="40" y2="40" /><line x1="30" x2="430" y1="100" y2="100" /><line x1="30" x2="430" y1="160" y2="160" /><line x1="30" x2="430" y1="210" y2="210" /></g>
              <path d="M250 120 L290 105 L330 70 L370 80 L410 55 L410 125 L370 140 L330 135 L290 150 L250 140Z" fill="url(#gA)" />
              <path id="chartLine" d="M30 170 L70 150 L110 160 L150 120 L190 130 L230 110 L250 130 L290 128 L330 102 L370 110 L410 90" fill="none" stroke="#0fa08f" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="250" x2="250" y1="30" y2="215" stroke="#ff4d5e" strokeDasharray="5 5" />
              <text x="256" y="44" fontSize="11" fill="#ff4d5e" fontWeight="700">NOW</text>
              <g fontSize="10" fill="#7a909c"><text x="30" y="228">6 AM</text><text x="130" y="228">12 PM</text><text x="250" y="228">6 PM</text><text x="370" y="228">12 AM</text></g>
            </svg>
            <div className="legend"><span><i style={{ background: '#0fa08f' }}></i>Demand</span><span><i style={{ background: 'rgba(25,195,177,.35)' }}></i>Forecast range</span></div>
            <p className="note">Illustrative chart.</p>
          </div>
        </div>
      </section>

      <section className="tint">
        <div className="wrap">
          <p className="kick reveal">Design Principles</p>
          <h2 className="reveal">Calm design for the worst moments.</h2>
          <p className="sub reveal">People use MediBridge when they are scared and in a hurry. Every screen is shaped by that.</p>
          <div className="grid4">
            <div className="p reveal"><div className="ic">⚡</div><h3>Speed</h3><p>One request, entered once, reaches everyone who needs it.</p></div>
            <div className="p reveal"><div className="ic">🔍</div><h3>Transparency</h3><p>A live, time-stamped timeline shows what has happened and what is next.</p></div>
            <div className="p reveal"><div className="ic">🛡️</div><h3>Trust</h3><p>Role-based access and a full activity record keep every case accountable.</p></div>
            <div className="p reveal"><div className="ic">♿</div><h3>Accessibility</h3><p>Large controls, simple language and light screens that work on weak connections.</p></div>
          </div>
        </div>
      </section>

      <section id="pilot" className="dark">
        <div className="wrap">
          <div className="pilot">
            <div className="reveal">
              <p className="kick">Where it starts</p>
              <h2>A focused pilot in Delhi NCR.</h2>
              <p className="sub" style={{ marginBottom: 20 }}>MediBridge begins with a curated directory of facilities and a limited demonstration area, proving the idea in one region before growing outward.</p>
              <div className="future" style={{ marginTop: 10 }}>
                {['Hospital partnerships', 'Ambulance providers', 'More cities'].map((t) => (
                  <span key={t} style={{ background: 'rgba(255,255,255,.08)', borderColor: 'rgba(255,255,255,.2)', color: '#d6eaf1' }}>{t}</span>
                ))}
              </div>
            </div>
            <div className="map reveal">
              <div className="ring"></div><div className="ring"></div><div className="ring"></div>
              <div className="dot" style={{ left: '30%', top: '28%' }}></div><div className="dot" style={{ left: '62%', top: '22%' }}></div>
              <div className="dot r" style={{ left: '48%', top: '46%' }}></div><div className="dot" style={{ left: '70%', top: '60%' }}></div>
              <div className="dot" style={{ left: '26%', top: '64%' }}></div><div className="dot" style={{ left: '50%', top: '76%' }}></div>
              <div className="mapname">DELHI<br />NCR</div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <p className="kick reveal">The Journey Ahead</p>
          <h2 className="reveal">From idea to a working bridge.</h2>
          <p className="sub reveal">Each phase ends with something real that can be seen and tested.</p>
          <div className="road2">
            <div className="m reveal"><i>🧭</i><h4>Design</h4><p>Research, user flows and screens</p></div>
            <div className="m reveal"><i>🧱</i><h4>Core</h4><p>Requests, hospital directory, dashboards</p></div>
            <div className="m reveal"><i>📡</i><h4>Live</h4><p>Real-time confirmations and tracking</p></div>
            <div className="m reveal"><i>🧠</i><h4>Smart</h4><p>Forecasts and arrival estimates</p></div>
            <div className="m reveal"><i>🚀</i><h4>Launch</h4><p>Testing, polish and demonstration</p></div>
          </div>
          <h3 className="reveal" style={{ margin: '50px 0 6px', color: 'var(--ink2)' }}>Where it can grow</h3>
          <div className="future reveal">
            <span>🏥 Connection with hospital systems</span><span>📱 Mobile app</span><span>🗣️ Multilingual voice requests</span>
            <span>📊 Deeper analytics</span><span>🌆 More cities</span><span>🚦 Live traffic-aware arrival times</span>
          </div>
        </div>
      </section>

      <section className="final">
        <div className="wrap">
          <h2 className="reveal">When every second counts, no one should face the search alone.</h2>
          <p className="reveal">MediBridge connects people to care, and care to people, through one clear, trackable journey.</p>
          <a href="#live" className="btn p reveal">Watch the demo again</a>
        </div>
      </section>
      <footer>MediBridge &middot; Emergency Care Coordination Platform &middot; Project Proposal</footer>
    </div>
  );
}
