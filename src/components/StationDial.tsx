import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { MAIDENS } from "../data/maidens";
import { useStation } from "../lib/station";

const SWEEP = 270; // degrees of dial travel, from -135° to +135°
const angleFor = (i: number) => -SWEEP / 2 + (SWEEP / (MAIDENS.length - 1)) * i;

export function StationDial() {
  const { current, tune, audioOn, toggleAudio } = useStation();
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const index = MAIDENS.indexOf(current);

  const tuneToPointer = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0° is straight up
    let best = 0;
    MAIDENS.forEach((_, i) => {
      if (Math.abs(angleFor(i) - deg) < Math.abs(angleFor(best) - deg)) best = i;
    });
    if (best !== index) tune(MAIDENS[best]);
  };

  const onKey = (e: KeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    tune(MAIDENS[(index + step + MAIDENS.length) % MAIDENS.length]);
  };

  return (
    <div className="dial-wrap">
      <div
        className="dial"
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label="Station tuner"
        aria-valuemin={0}
        aria-valuemax={MAIDENS.length - 1}
        aria-valuenow={index}
        aria-valuetext={`${current.station} with ${current.name}, FM ${current.freq}`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest(".dial__listen")) return;
          dragging.current = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          tuneToPointer(e);
        }}
        onPointerMove={(e) => dragging.current && tuneToPointer(e)}
        onPointerUp={() => (dragging.current = false)}
      >
        <svg viewBox="-100 -100 200 200" className="dial__face" aria-hidden="true">
          <circle r="92" className="dial__rim" />
          {Array.from({ length: 55 }, (_, i) => {
            const a = ((-SWEEP / 2 + (SWEEP / 54) * i) * Math.PI) / 180;
            const long = i % 6.75 < 1;
            return (
              <line
                key={i}
                x1={Math.sin(a) * 84}
                y1={-Math.cos(a) * 84}
                x2={Math.sin(a) * (long ? 76 : 80)}
                y2={-Math.cos(a) * (long ? 76 : 80)}
                className="dial__tick"
              />
            );
          })}
          {MAIDENS.map((m, i) => {
            const a = (angleFor(i) * Math.PI) / 180;
            return (
              <circle
                key={m.slug}
                cx={Math.sin(a) * 66}
                cy={-Math.cos(a) * 66}
                r={i === index ? 5 : 3}
                fill={m.color}
                className="dial__dot"
                style={{ opacity: i === index ? 1 : 0.55 }}
              />
            );
          })}
        </svg>
        <div className="dial__knob" style={{ transform: `rotate(${angleFor(index)}deg)` }}>
          <span className="dial__needle" />
        </div>
        <button className={`dial__listen ${audioOn ? "is-on" : ""}`} onClick={toggleAudio} aria-pressed={audioOn}>
          {audioOn ? "◼ Stop" : "▶ Listen"}
        </button>
      </div>

      <div className="dial__readout" aria-live="polite">
        <span className="mono">FM {current.freq}</span>
        <strong>{current.station}</strong>
        <span>
          with {current.name} · {current.genre} · {current.bpm[0]}–{current.bpm[1]} BPM
        </span>
        {!current.live && <span className="dial__soon">Coming soon</span>}
      </div>

      <ul className="dial__list">
        {MAIDENS.map((m) => (
          <li key={m.slug}>
            <button
              className={`${m === current ? "is-active" : ""} ${m.live ? "" : "is-soon"}`}
              style={{ "--m": m.color } as CSSProperties}
              onClick={() => tune(m)}
            >
              <span className="mono">{m.freq}</span> {m.station}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
