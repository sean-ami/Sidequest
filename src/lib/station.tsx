import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Ambience } from "../audio/ambience";
import { MAIDENS, type Maiden } from "../data/maidens";

type StationState = {
  current: Maiden;
  tune: (m: Maiden) => void;
  audioOn: boolean;
  toggleAudio: () => void;
  thunder: () => void;
  pop: () => void;
};

const Ctx = createContext<StationState | null>(null);

export function StationProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Maiden>(MAIDENS[1]);
  const [audioOn, setAudioOn] = useState(false);
  const engine = useRef<Ambience | null>(null);

  // AudioContext must be created after a user gesture.
  const getEngine = () => (engine.current ??= new Ambience());

  const tune = useCallback((m: Maiden) => setCurrent(m), []);

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--accent", current.color);
    root.setProperty("--accent-2", current.color2);
    if (audioOn) getEngine().play(current);
  }, [current, audioOn]);

  const toggleAudio = useCallback(() => {
    setAudioOn((on) => {
      if (on) engine.current?.stop();
      return !on;
    });
  }, []);

  const value = useMemo<StationState>(
    () => ({
      current,
      tune,
      audioOn,
      toggleAudio,
      thunder: () => audioOn && engine.current?.thunder(),
      pop: () => getEngine().pop(),
    }),
    [current, tune, audioOn, toggleAudio],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStation() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStation outside StationProvider");
  return v;
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
