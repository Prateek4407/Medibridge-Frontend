/* =====================================================================
   Ambulance Response Delay Prediction - API CALL
   ---------------------------------------------------------------------
   Settings come from a file called .env (see .env.example):
     VITE_API_BASE_URL   e.g. http://localhost:8000   (empty = DEMO MODE)
     VITE_PREDICT_PATH   default /predict/response-delay
     VITE_USE_MOCK       "true" forces demo mode even if a URL is set

   Expected request : POST  {BASE}{PATH}   body = JSON from buildPayload()
   Expected response: { "predicted_delay_minutes": 7.4,
                        "range": { "low": 5.8, "high": 9.1 },     (optional)
                        "range_note": "...", "warnings": ["..."],   (optional)
                        "model_version": "random-forest-v1" }      (optional)
   The service lives in the MediBridge-ml repository (main.py, FastAPI). Default path: /predict/response-delay.
   ===================================================================== */

const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const PATH = import.meta.env.VITE_PREDICT_PATH || '/predict/response-delay'
// Render's free plan puts the service to sleep when idle; waking it up can take about a minute.
const TIMEOUT_MS = 60000

export const API_URL = BASE + PATH
export const IS_DEMO = !BASE || import.meta.env.VITE_USE_MOCK === 'true'

export class PredictionError extends Error {
  /* kind: network | timeout | validation | server | response | cancelled */
  constructor(kind, message, fieldErrors) { super(message); this.kind = kind; this.fieldErrors = fieldErrors }
}

/* Called when the prediction page opens: wakes a sleeping service so the first real prediction is fast. */
export function warmUp() {
  if (IS_DEMO) return
  fetch(BASE + '/health', { method: 'GET' }).catch(() => {})
}

export async function predictDelay(payload, { signal } = {}) {
  return IS_DEMO ? mockPredict(payload, signal) : realPredict(payload, signal)
}

/* ---------------- real backend ---------------- */
async function realPredict(payload, outerSignal) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort('timeout'), TIMEOUT_MS)
  const onAbort = () => ctrl.abort('cancelled')
  outerSignal?.addEventListener('abort', onAbort)
  let res
  try {
    res = await fetch(API_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload), signal: ctrl.signal,
    })
  } catch (e) {
    if (ctrl.signal.aborted) {
      throw ctrl.signal.reason === 'timeout'
        ? new PredictionError('timeout', 'The prediction service took too long to respond. Please try again.')
        : new PredictionError('cancelled', 'Request cancelled.')
    }
    throw new PredictionError('network', 'Cannot reach the prediction service. Check your internet connection or that the backend is running.')
  } finally {
    clearTimeout(timer); outerSignal?.removeEventListener('abort', onAbort)
  }

  let data = null
  try { data = await res.json() } catch (e) { /* body is not JSON */ }

  if (!res.ok) {
    if (res.status === 422 || res.status === 400) {
      throw new PredictionError('validation', 'The server did not accept some inputs. Please check the highlighted fields.', fieldErrorsFrom(data))
    }
    throw new PredictionError('server', res.status >= 500
      ? 'The prediction service had a problem (error ' + res.status + '). Please try again in a moment.'
      : 'The request was rejected (error ' + res.status + ').')
  }
  return normalise(data)
}

/* FastAPI style: { detail: [ { loc: ["body","distance_km"], msg: "..." } ] } */
function fieldErrorsFrom(data) {
  const out = {}
  const list = data && Array.isArray(data.detail) ? data.detail : []
  for (const d of list) {
    const key = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : null
    if (typeof key === 'string') out[key] = d.msg || 'Invalid value.'
  }
  return Object.keys(out).length ? out : undefined
}

/* accept a few common key names so small backend changes do not break the page */
function normalise(data) {
  const raw = data && (data.predicted_delay_minutes ?? data.delay_minutes ?? data.predicted_delay ?? data.minutes ?? data.prediction)
  const minutes = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0) {
    throw new PredictionError('response', 'The prediction service sent an unexpected answer. Please try again or contact the backend team.')
  }
  let range = data.range ?? data.confidence_interval ?? null
  if (Array.isArray(range) && range.length === 2) range = { low: range[0], high: range[1] }
  if (range && !(Number.isFinite(range.low) && Number.isFinite(range.high))) range = null
  const warnings = Array.isArray(data.warnings) ? data.warnings.filter((w) => typeof w === 'string') : []
  return { minutes, range, rangeNote: typeof data.range_note === 'string' ? data.range_note : null, modelVersion: data.model_version ?? data.version ?? null, warnings, demo: false }
}

/* ---------------- demo mode (no backend needed) ----------------
   A simple made-up formula so the screen can be demonstrated before the
   real model is connected. It is NOT the machine-learning model. */
function mockPredict(p, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      const traffic = { low: 1, medium: 1.25, high: 1.6 }[p.traffic_level] || 1
      const weather = { clear: 0, cloudy: 0.3, rainy: 1.2, foggy: 1.6 }[p.weather_condition] || 0
      const rush = [7, 8, 9, 17, 18, 19, 20].includes(p.hour_of_day) ? 1.5 : 0
      const status = { available: 0, limited: 1, busy: 2.5 }[p.partner_status] || 0
      const supply = Math.max(0, 5 - p.available_ambulance_count) * 0.6
      const minutes = Math.max(2, (3 + p.distance_km * 0.5) * traffic + weather + rush + status + supply)
      resolve({ minutes: Math.round(minutes * 10) / 10, range: { low: Math.round(minutes * 0.8 * 10) / 10, high: Math.round(minutes * 1.25 * 10) / 10 }, modelVersion: 'demo-formula', warnings: [], demo: true })
    }, 900)
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new PredictionError('cancelled', 'Request cancelled.')) })
  })
}
