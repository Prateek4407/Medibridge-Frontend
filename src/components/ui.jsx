import React from 'react';

/* segmented buttons (Patient / Doctor, Male / Female ...) */
export function Seg({ value, onChange, options, className = '', id }) {
  return (
    <div className={('seg ' + className).trim()} id={id}>
      {options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return (
          <button type="button" key={v} data-v={v} className={v === value ? 'on' : ''} onClick={() => onChange && onChange(v)}>{l}</button>
        );
      })}
    </div>
  );
}

/* labelled form field with optional validation message */
export function Field({ label, req, bad, msg, hint, htmlFor, className = '', style, children }) {
  return (
    <div className={('field ' + className + (bad ? ' bad' : '')).trim()} style={style}>
      {label && <label htmlFor={htmlFor}>{label}{req && <> <em>*</em></>}</label>}
      {children}
      {msg && <div className="msg">{msg}</div>}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
