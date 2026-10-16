/* Helpers for the patient/doctor medical-documents feature.
   Files are uploaded to the backend (POST /documents) and fetched with the login token. */
import { api } from './api.js';

export const DOC_TYPES = [
  { v: 'history', label: 'Medical history' },
  { v: 'lab', label: 'Lab / test report' },
  { v: 'prescription', label: 'Prescription' },
  { v: 'imaging', label: 'Imaging / scan (X-ray, MRI, CT)' },
  { v: 'discharge', label: 'Discharge summary' },
  { v: 'insurance', label: 'Insurance document' },
  { v: 'id', label: 'ID proof' },
  { v: 'other', label: 'Other' },
];
/* frontend type  <->  category name used by the backend */
export const CATEGORY = {
  history: 'Medical History', lab: 'Lab Report', prescription: 'Prescription', imaging: 'Imaging / Scan',
  discharge: 'Discharge Summary', insurance: 'Insurance', id: 'ID Proof', other: 'Other',
};
const TYPE_OF = Object.fromEntries(Object.entries(CATEGORY).map(([t, c]) => [c, t]));
export const typeLabel = (v) => (DOC_TYPES.find((t) => t.v === v) || { label: 'Other' }).label.split(' (')[0];

/* backend document -> shape used by the components */
export const normDoc = (d) => ({ ...d, type: TYPE_OF[d.category] || 'other', mime: d.mimeType, uploadedAt: d.createdAt, ownerId: d.owner });

export const MAX_MB = 10;                          // same limit as the backend
export const MAX_BYTES = MAX_MB * 1024 * 1024;
export const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt';
const OK_EXT = ACCEPT.split(',').map((e) => e.slice(1));

export const extOf = (name) => (name.split('.').pop() || '').toLowerCase();
export const fileTag = (name) => {
  const e = extOf(name);
  return ['jpg', 'jpeg', 'png', 'webp'].includes(e) ? 'IMG' : e === 'docx' ? 'DOC' : e.toUpperCase().slice(0, 4);
};
export const isImage = (d) => (d.mime || '').startsWith('image/');
export const isPdf = (d) => d.mime === 'application/pdf' || extOf(d.fileName) === 'pdf';
export const isText = (d) => (d.mime || '').startsWith('text/') || extOf(d.fileName) === 'txt';

export function fmtSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

export function checkFile(f) {
  if (!OK_EXT.includes(extOf(f.name))) return f.name + ': file type not supported (use PDF, image, Word or text).';
  if (f.size > MAX_BYTES) return f.name + ': larger than ' + MAX_MB + ' MB (' + fmtSize(f.size) + ').';
  if (f.size === 0) return f.name + ': the file is empty.';
  return '';
}

export async function downloadDoc(d) {
  const blob = await api.blob('/documents/' + d.id + '/file?download=1');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = d.fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
