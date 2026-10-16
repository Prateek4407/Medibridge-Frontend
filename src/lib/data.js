/* Shared constants and small helpers.
   Hospitals, cases, slots, invoices and documents now come from the backend API (see lib/api.js). */

export function ymd(offset) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export const loadColor = { Low: '#10b981', Moderate: '#f59e0b', High: '#f59e0b', Saturated: '#e53935' };
export const loadClass = { Low: 'g', Moderate: 'a', High: 'a', Saturated: 'r' };

export const fmtTime = (ts) =>
  new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/* live tracking stages (same six stages as the backend) */
export const STAGES = [
  ['Request received', 'Case created and triage priority assigned'],
  ['Hospital confirmed', 'Hospital acknowledged and prepared a bay'],
  ['Ambulance assigned', 'Ambulance leaving the hospital for the patient'],
  ['Pickup done', 'Patient loaded and stabilised on scene'],
  ['On the way to hospital', 'Priority transit to the hospital'],
  ['Arrived at hospital', 'Handoff to the receiving team'],
];
export const STEP_MS = 6000;   // backend moves a case forward every 6 seconds (STAGE_STEP_MS)

export const statusOf = (c) => (c.stage >= 5 ? ['Handoff completed', 'green'] : ['In transit', 'estimated']);

export const SAMPLE_PATIENTS = [
  { id: 'CB-1301', name: 'Amit Verma', age: '48', sex: 'Male', care: 'Cardiac', sev: 'P1', status: 'Handoff completed', address: 'Sample record' },
  { id: 'CB-1288', name: 'Pooja Sharma', age: '34', sex: 'Female', care: 'Emergency', sev: 'P2', status: 'Transferred', address: 'Sample record' },
];
