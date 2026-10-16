import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

/* toast + modal + router helpers shared by every page */
export function AppProvider({ children }) {
  const [toastMsg, setToastMsg] = useState('');
  const [toastOn, setToastOn] = useState(false);
  const [modal, setModal] = useState(null);          // { node, wide }
  const toastTimer = useRef();
  const nextAfterLogin = useRef(null);
  const pendingScroll = useRef(null);

  const toast = useCallback((msg) => {
    setToastMsg(msg); setToastOn(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastOn(false), 2800);
  }, []);
  const openModal = useCallback((node, opts = {}) => setModal({ node, wide: !!opts.wide }), []);
  const closeModal = useCallback(() => setModal(null), []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setModal(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const value = { toast, toastMsg, toastOn, modal, openModal, closeModal, nextAfterLogin, pendingScroll };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const go = (route) => { window.location.hash = '#/' + route; };
