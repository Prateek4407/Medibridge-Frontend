import { useCallback, useEffect, useRef, useState } from 'react';

/* Load data from the API.  useFetch(() => api.get('/slots'), [deps], { interval: 4000 })
   -> { data, error, loading, reload }.  Re-runs when deps change, optionally polls. */
export function useFetch(loader, deps = [], { interval } = {}) {
  const [st, setSt] = useState({ data: null, error: null, loading: true });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const seq = useRef(0);

  const run = useCallback(async (quiet) => {
    const my = ++seq.current;
    if (!quiet) setSt((s) => ({ ...s, loading: true }));
    try {
      const data = await loaderRef.current();
      if (my === seq.current) setSt({ data, error: null, loading: false });
    } catch (e) {
      if (my === seq.current) setSt((s) => ({ data: s.data, error: e, loading: false }));
    }
  }, []);

  useEffect(() => {
    run(false);
    if (!interval) return undefined;
    const t = setInterval(() => run(true), interval);
    return () => { clearInterval(t); seq.current++; };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { seq.current++; }, []);
  return { ...st, reload: useCallback(() => run(true), [run]) };
}
