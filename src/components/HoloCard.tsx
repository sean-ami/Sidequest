import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import type { Maiden } from "../data/maidens";
import { Placeholder } from "./ParallaxScene";

/** Trading-card style Maiden card: tilts and catches holo light on hover, flips on click. */
export function HoloCard({ maiden, index }: { maiden: Maiden; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);

  const onMove = (e: PointerEvent) => {
    const el = ref.current!;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(0.5 - y) * 18}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * 22}deg`);
    el.style.setProperty("--px", `${x * 100}%`);
    el.style.setProperty("--py", `${y * 100}%`);
    el.style.setProperty("--hyp", `${Math.min(1, Math.hypot(x - 0.5, y - 0.5) * 2)}`);
  };
  const onLeave = () => {
    const el = ref.current!;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--hyp", "0");
  };

  const img = maiden.art?.card ?? maiden.art?.scene;
  const imgSm = maiden.art?.cardSm ?? maiden.art?.sceneSm;
  const objectPosition = maiden.art?.portrait ? "50% 15%" : `${(maiden.art?.card ? 0.7 : (maiden.art?.focus?.x ?? 0.5)) * 100}% 30%`;

  return (
    <div
      className={`holo ${flipped ? "is-flipped" : ""}`}
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ "--m": maiden.color, "--m2": maiden.color2, "--i": index } as CSSProperties}
    >
      <button className="holo__inner" onClick={() => setFlipped((f) => !f)} aria-label={`${maiden.name}: flip card`}>
        <div className="holo__face holo__front">
          <div className="holo__art">
            {img ? (
              <img src={imgSm} srcSet={`${imgSm} 960w, ${img} 1920w`} sizes="320px" alt="" style={{ objectPosition }} loading="lazy" />
            ) : (
              <Placeholder maiden={maiden} />
            )}
          </div>
          <div className="holo__foil" />
          <div className="holo__glare" />
          <div className="holo__label">
            <span className="mono">No. {String(index + 1).padStart(2, "0")} · FM {maiden.freq}</span>
            <strong>{maiden.name}</strong>
            <span>{maiden.station}</span>
          </div>
        </div>
        <div className="holo__face holo__back">
          <span className="mono">{maiden.station}</span>
          <strong>{maiden.name}</strong>
          <p>{maiden.tagline}</p>
          <dl>
            <dt>Genre</dt>
            <dd>{maiden.genre}</dd>
            <dt>Tempo</dt>
            <dd>
              {maiden.bpm[0]}–{maiden.bpm[1]} BPM
            </dd>
            <dt>For</dt>
            <dd>{maiden.use}</dd>
            {maiden.signature && (
              <>
                <dt>Signature</dt>
                <dd>{maiden.signature}</dd>
              </>
            )}
          </dl>
        </div>
      </button>
      <Link className="holo__link" to={`/${maiden.slug}`}>
        Visit {maiden.station} →
      </Link>
    </div>
  );
}
