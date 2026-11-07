import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type Dispatch, type ReactNode, type SetStateAction,
} from 'react';
import { readState, storageKey, type State } from './model';

interface Store {
  state: State;
  setState: Dispatch<SetStateAction<State>>;
  notify: (message: string) => void;
}

const Ctx = createContext<Store>(null!);
export const useApp = () => useContext(Ctx);

export function Provider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(readState);
  const [toast, setToast] = useState('');

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch { /* Private mode keeps the preview in memory for this session. */ }
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = useCallback((message: string) => setToast(message), []);
  const value = useMemo(() => ({ state, setState, notify }), [state, notify]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && (
        <div className="toast" role="status" style={{ transform: 'translateX(-50%)' }}>
          {toast}
        </div>
      )}
    </Ctx.Provider>
  );
}

