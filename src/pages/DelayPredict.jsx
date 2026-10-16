import React, { useEffect, useRef, useState } from 'react'
import { Field } from '../components/ui.jsx'
import { FIELDS, emptyValues, currentTimeValues, validate, buildPayload } from '../lib/predictionConfig.js'
import { predictDelay, IS_DEMO, API_URL } from '../lib/predictionApi.js'
import { api } from '../lib/api.js'

/* the estimate note: always visible next to the result */
function EstimateNote() {
  return (
    <div className="docprompt" role="note">
      <span aria-hidden="true">&#9432;</span>
      <span>
        <b>This is an estimate, not an exact arrival time.</b>
        The predicted delay is based on past patterns and the details you enter. The ambulance may arrive earlier or later.
        In a life-threatening emergency call 112 or 102 immediately.
      </span>
    </div>
  )
}

const ERROR_TITLES = {
  network: 'Cannot reach the prediction service', timeout: 'The service is taking too long', validation: 'Please check your inputs',
  server: 'The prediction service had a problem', response: 'Unexpected answer from the service',
}

function ResultPanel({ status, onRetry }) {
  if (status.state === 'loading') {
    return (
      <div role="status" aria-live="polite" className="pred-state">
        <span className="spin" aria-hidden="true" />
        <b>Predicting response delay...</b>
        <small className="muted">Contacting the prediction service</small>
      </div>
    )
  }
  if (status.state === 'error') {
    const e = status.error
    return (
      <div role="alert" className="pred-state pred-error">
        <b>{ERROR_TITLES[e.kind] || 'Prediction failed'}</b>
        <p>{e.message}</p>
        {e.kind !== 'validation' && <button type="button" className="b-out b-sm" onClick={onRetry}>Try again</button>}
      </div>
    )
  }
  if (status.state === 'success') {
    const { result } = status
    const r = result.range
    return (
      <div role="status" aria-live="polite">
        <div className="pred-label">Predicted response delay {result.demo && <span className="badge simulated">Demo estimate</span>}</div>
        <div className="delay-big"><b>{result.minutes.toFixed(1)}</b><span> minutes</span></div>
        {r && <p className="pred-range">Likely between <b>{Number(r.low).toFixed(1)}</b> and <b>{Number(r.high).toFixed(1)}</b> minutes</p>}
        {result.rangeNote && <p className="small muted">{result.rangeNote}</p>}
        {result.warnings && result.warnings.map((w) => <p key={w} className="small err" role="alert">{w}</p>)}
        <p className="small muted" style={{ marginTop: 8 }}>
          {result.modelVersion ? 'Model: ' + result.modelVersion + ' \u2022 ' : ''}Updated {status.at}
        </p>
      </div>
    )
  }
  return (
    <div className="pred-state">
      <b>No prediction yet</b>
      <small className="muted">Fill in the form and press &ldquo;Predict Response Delay&rdquo;.</small>
    </div>
  )
}

export default function DelayPredict() {
  const [values, setValues] = useState(emptyValues)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState({ state: 'idle' })
  const reqId = useRef(0)
  const ctrl = useRef(null)
  const loading = status.state === 'loading'

  useEffect(() => () => ctrl.current?.abort(), [])   // cancel a running request when leaving the page

  /* if the hospitals manage a fleet, fill "Ambulances available nearby" with the real free count (the user can still change it) */
  const [fleet, setFleet] = useState(null)
  useEffect(() => {
    let dead = false
    api.get('/ambulances/availability').then((r) => {
      const d = r.data
      if (dead || !d || !d.total) return
      setFleet(d)
      setValues((p) => (String(p.available_ambulance_count) === '' ? { ...p, available_ambulance_count: String(Math.min(99, d.available)) } : p))
    }).catch(() => {})
    return () => { dead = true }
  }, [])

  const set = (key, v) => {
    setValues((p) => ({ ...p, [key]: v }))
    if (errors[key]) setErrors((p) => { const n = { ...p }; delete n[key]; return n })
  }

  async function submit(e) {
    e.preventDefault()
    if (loading) return
    const errs = validate(values)
    setErrors(errs)
    const first = Object.keys(errs)[0]
    if (first) {
      setStatus({ state: 'idle' })
      setTimeout(() => document.getElementById('f_' + first)?.focus(), 0)
      return
    }
    const id = ++reqId.current
    ctrl.current?.abort()
    ctrl.current = new AbortController()
    setStatus({ state: 'loading' })
    try {
      const result = await predictDelay(buildPayload(values), { signal: ctrl.current.signal })
      if (id !== reqId.current) return
      setStatus({ state: 'success', result, at: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) })
    } catch (err) {
      if (id !== reqId.current || err.kind === 'cancelled') return
      if (err.fieldErrors) setErrors(err.fieldErrors)
      setStatus({ state: 'error', error: err })
    }
  }

  const reset = () => { ctrl.current?.abort(); reqId.current++; setValues({ ...emptyValues(), ...(fleet ? { available_ambulance_count: String(Math.min(99, fleet.available)) } : {}) }); setErrors({}); setStatus({ state: 'idle' }) }
  const useNow = () => setValues((p) => ({ ...p, ...currentTimeValues() }))
  const retry = () => document.getElementById('predictForm')?.requestSubmit()

  const errCount = Object.keys(errors).length

  return (
    <>
      <h1 className="ph">Ambulance Response Delay Prediction</h1>
      <p className="ph-sub">Estimate how long an ambulance may take to respond, based on the situation you describe.</p>
      <p style={{ marginBottom: 16 }}>
        {IS_DEMO
          ? <span className="badge simulated">Demo mode: built-in estimate, backend not connected</span>
          : <span className="badge verified" title={API_URL}>Connected to prediction service</span>}
      </p>

      <div className="g2-wide">
        <div className="card">
          <form id="predictForm" onSubmit={submit} noValidate aria-busy={loading}>
            <h3>Ambulance request details</h3>
            <p className="small muted" style={{ marginBottom: 16 }}>All fields are required.{fleet ? ' "Ambulances available nearby" is pre-filled with the live MediBridge fleet count (' + fleet.available + ' free of ' + fleet.total + '); change it if you know better.' : ''}</p>

            <fieldset disabled={loading} className="pred-fields">
              <div className="row2">
                {FIELDS.map((f) => (
                  <Field key={f.key} label={f.label} req={f.required} htmlFor={'f_' + f.key} bad={!!errors[f.key]} msg={errors[f.key]} hint={!errors[f.key] ? f.hint : null}>
                    {f.type === 'select' ? (
                      <select id={'f_' + f.key} value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} aria-invalid={!!errors[f.key]}>
                        <option value="">{f.placeholder}</option>
                        {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    ) : (
                      <input id={'f_' + f.key} type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step} placeholder={f.placeholder}
                        value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} aria-invalid={!!errors[f.key]} />
                    )}
                  </Field>
                ))}
              </div>
            </fieldset>

            {errCount > 0 && <p className="err" role="alert">Please fix the {errCount} highlighted field{errCount > 1 ? 's' : ''}.</p>}

            <div className="formnav">
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" className="b-out" onClick={useNow} disabled={loading}>Use current time</button>
                <button type="button" className="b-out" onClick={reset}>Reset</button>
              </div>
              <button type="submit" className="b-primary" disabled={loading}>
                {loading ? <><span className="spin sm" aria-hidden="true" /> Predicting...</> : 'Predict Response Delay'}
              </button>
            </div>
            <p className="small muted" style={{ marginTop: 12 }}>The estimate is for information only and does not dispatch an ambulance.</p>
          </form>
        </div>

        <aside>
          <div className="card pred-card">
            <h3>Prediction result</h3>
            <ResultPanel status={status} onRetry={retry} />
          </div>
          <EstimateNote />
        </aside>
      </div>
    </>
  )
}
