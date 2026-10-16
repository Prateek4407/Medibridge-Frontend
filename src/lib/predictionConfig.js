/* =====================================================================
   Ambulance Response Delay Prediction - FORM FIELDS
   ---------------------------------------------------------------------
   This is the ONLY file you need to edit when the backend team changes
   the input fields. Each entry becomes one input on the form, is
   validated automatically and is sent to the API under its `key`.

   The keys, units and allowed values match the trained model and the
   prediction service (MediBridge_ml: app.py). Change them together.
   ===================================================================== */

const HOURS = Array.from({ length: 24 }, (_, h) => [String(h), String(h).padStart(2, '0') + ':00 - ' + String(h).padStart(2, '0') + ':59'])
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1)

/* These 12 fields are exactly the inputs of the trained model (MediBridge_ml: train_model.py).
   The two engineered features (distance per ambulance, peak hour) are computed by the prediction service. */
export const FIELDS = [
  {
    key: 'locality', label: 'Area / locality', type: 'select', required: true, placeholder: 'Select area',
    options: ['Airport Road', 'Central Market', 'Green Park', 'Harbor View', 'Hillcrest', 'Industrial Zone', 'Lakeview', 'Maple Heights', 'Northgate', 'Old Town', 'Riverside', 'Southfield', 'Sunrise Colony', 'University Area'].map((a) => [a, a]),
  },
  {
    key: 'distance_km', label: 'Distance to the responding unit (km)', type: 'number', required: true,
    min: 0, max: 200, step: 0.1, placeholder: 'e.g. 5', hint: 'Most past cases were under 15 km',
  },
  {
    key: 'partner_type', label: 'Responding unit is a', type: 'select', required: true, placeholder: 'Select type',
    options: [['ambulance', 'Ambulance'], ['hospital', 'Hospital']],
  },
  {
    key: 'partner_status', label: 'Responding unit status', type: 'select', required: true, placeholder: 'Select status',
    options: [['available', 'Available'], ['limited', 'Limited availability'], ['busy', 'Busy']],
  },
  {
    key: 'availability_age_min', label: 'Minutes since its availability was last updated', type: 'number', required: true,
    min: 0, max: 1440, step: 1, placeholder: 'e.g. 10', hint: 'Enter 0 if it was just updated',
  },
  {
    key: 'hour_of_day', label: 'Hour of request', type: 'select', required: true, asNumber: true, placeholder: 'Select hour', options: HOURS,
  },
  {
    key: 'day_of_week', label: 'Day of week', type: 'select', required: true, placeholder: 'Select day',
    options: DAYS.map((d) => [d, cap(d)]),
  },
  {
    key: 'traffic_level', label: 'Traffic level', type: 'select', required: true, placeholder: 'Select traffic',
    options: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']],
  },
  {
    key: 'weather_condition', label: 'Weather', type: 'select', required: true, placeholder: 'Select weather',
    options: [['clear', 'Clear'], ['cloudy', 'Cloudy'], ['rainy', 'Rainy'], ['foggy', 'Foggy']],
  },
  {
    key: 'hospital_capacity_status', label: 'Hospital capacity', type: 'select', required: true, placeholder: 'Select capacity',
    options: [['available', 'Available'], ['limited', 'Limited'], ['unavailable', 'Unavailable'], ['not_applicable', 'Not applicable']],
  },
  {
    key: 'available_ambulance_count', label: 'Ambulances available nearby', type: 'number', required: true,
    min: 0, max: 99, step: 1, integer: true, placeholder: 'e.g. 5', hint: 'Whole number, 0 to 99',
  },
  {
    key: 'dispatch_mode', label: 'Dispatch mode', type: 'select', required: true, placeholder: 'Select mode',
    options: [['automated', 'Automated'], ['manual', 'Manual']],
  },
]

/* "Use current time" button fills these two fields */
export function currentTimeValues() {
  const d = new Date()
  return { hour_of_day: String(d.getHours()), day_of_week: DAYS[(d.getDay() + 6) % 7] } // JS Sunday=0 -> our Monday first
}

export function emptyValues() {
  const base = Object.fromEntries(FIELDS.map((f) => [f.key, '']))
  return { ...base, ...currentTimeValues() }
}

/* ---------- validation (runs before the API is called) ---------- */
export function validate(values) {
  const errors = {}
  for (const f of FIELDS) {
    const raw = String(values[f.key] ?? '').trim()
    if (raw === '') { if (f.required) errors[f.key] = f.type === 'select' ? 'Please choose an option.' : 'This field is required.'; continue }
    if (f.type === 'number') {
      const n = Number(raw)
      if (!Number.isFinite(n)) errors[f.key] = 'Enter a valid number.'
      else if (f.integer && !Number.isInteger(n)) errors[f.key] = 'Enter a whole number.'
      else if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) errors[f.key] = `Enter a value between ${f.min} and ${f.max}.`
    } else if (f.type === 'select' && !f.options.some(([v]) => v === raw)) {
      errors[f.key] = 'Please choose a valid option.'
    }
  }
  return errors
}

/* ---------- the JSON body sent to the backend ---------- */
export function buildPayload(values) {
  const out = {}
  for (const f of FIELDS) {
    const raw = String(values[f.key]).trim()
    out[f.key] = f.type === 'number' || f.asNumber ? Number(raw) : raw
  }
  return out
}
