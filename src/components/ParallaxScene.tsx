import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Maiden } from "../data/maidens";
import { prefersReducedMotion, useStation } from "../lib/station";
import { usePointer } from "../lib/usePointer";
import { Atmosphere } from "./Atmosphere";

type Props = {
  maiden: Maiden;
  /** Show print safe-area guides (§11): 2:1 mat and 3:2 poster crops. */
  guides?: boolean;
  className?: string;
};

const srcSet = (sm: string, full: string) => `${sm} 960w, ${full} 1920w`;
const SIZES = "(max-width: 900px) 100vw, 1400px";

export function ParallaxScene({ maiden, guides, className }: Props) {
  const pointer = usePointer();
  const artRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const { thunder } = useStation();

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let raf = 0;
    const tick = () => {
      const { x, y } = pointer.current;
      if (artRef.current) artRef.current.style.transform = `translate3d(${-x * 14}px, ${-y * 9}px, 0) scale(1.07)`;
      if (glowRef.current) glowRef.current.style.transform = `translate3d(${x * 26}px, ${y * 16}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pointer]);

  const focus = maiden.art?.focus ?? { x: 0.5, y: 0.4 };
  const style = {
    "--m": maiden.color,
    "--m2": maiden.color2,
    "--fx": `${focus.x * 100}%`,
    "--fy": `${focus.y * 100}%`,
    "--fxn": focus.x,
  } as CSSProperties;

  return (
    <div className={`scene scene--${maiden.mood} ${maiden.art?.portrait ? "scene--portrait" : ""} ${className ?? ""}`} style={style}>
      <div className="scene__art" ref={artRef}>
        {maiden.art?.bubble ? (
          <BubblePop maiden={maiden} />
        ) : maiden.art?.portrait ? (
          <PortraitComposite maiden={maiden} />
        ) : maiden.art ? (
          <img
            src={maiden.art.scene}
            srcSet={srcSet(maiden.art.sceneSm, maiden.art.scene)}
            sizes={SIZES}
            alt={`${maiden.name}, host of ${maiden.station}`}
            draggable={false}
          />
        ) : (
          <Placeholder maiden={maiden} />
        )}
      </div>
      <div className="scene__glow" ref={glowRef} />
      <Atmosphere
        mood={maiden.mood}
        color={maiden.color}
        color2={maiden.color2}
        pointer={pointer}
        depth={22}
        density={0.7}
        onLightning={maiden.mood === "rain" ? thunder : undefined}
      />
      <Atmosphere mood={maiden.mood === "rain" ? "rain" : maiden.mood} color={maiden.color} color2={maiden.color2} pointer={pointer} depth={60} density={0.25} />
      <div className="scene__vignette" />
      {!maiden.live && <ComingSoon />}
      {guides && (
        <div className="scene__guides" aria-hidden="true">
          <div className="guide guide--mat"><span>2:1 desk mat</span></div>
          <div className="guide guide--poster"><span>3:2 poster</span></div>
          <div className="guide guide--safe"><span>safe 84.4% × 88.9%</span></div>
        </div>
      )}
    </div>
  );
}

function BubblePop({ maiden }: { maiden: Maiden }) {
  const b = maiden.art!.bubble!;
  const focus = maiden.art!.focus!;
  const [phase, setPhase] = useState<"idle" | "pop" | "after">("idle");
  const { pop } = useStation();
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const trigger = () => {
    if (phase !== "idle") return;
    pop();
    setPhase("pop");
    timers.current.push(window.setTimeout(() => setPhase("after"), 380));
    timers.current.push(window.setTimeout(() => setPhase("idle"), 5200));
  };

  const frame = (src: string, sm: string, key: typeof phase, alt: string) => (
    <img
      src={src}
      srcSet={srcSet(sm, src)}
      sizes={SIZES}
      alt={alt}
      draggable={false}
      className={`frame ${phase === key ? "frame--on" : ""} frame--${key}`}
    />
  );

  return (
    <div className="bubble">
      {frame(b.after, b.afterSm, "after", "")}
      {frame(b.idle, b.idleSm, "idle", `${maiden.name} blowing a bubble on a neon rooftop`)}
      {frame(b.pop, b.popSm, "pop", "")}
      <button
        className={`bubble__hit ${phase === "idle" ? "is-ready" : ""}`}
        style={{ left: `${focus.x * 100}%`, top: `${focus.y * 100}%` }}
        onClick={trigger}
        aria-label="Pop Vega's bubble"
      />
    </div>
  );
}

/** Stages a 2:3 portrait on a 16:9 (or any) frame: the figure over a blurred wash of the same art. */
export function PortraitComposite({ maiden }: { maiden: Maiden }) {
  const art = maiden.art!;
  return (
    <div className="portrait">
      <img className="portrait__bg" src={art.sceneSm} alt="" draggable={false} />
      <img
        className="portrait__fig"
        src={art.scene}
        srcSet={`${art.sceneSm} 480w, ${art.scene} 832w`}
        sizes="(max-width: 900px) 100vw, 640px"
        alt={`${maiden.name}, host of ${maiden.station}`}
        draggable={false}
      />
    </div>
  );
}

export function Placeholder({ maiden }: { maiden: Maiden }) {
  return (
    <div className="placeholder" role="img" aria-label={`${maiden.name}: art coming soon`}>
      <div className="placeholder__sky" />
      <span className="placeholder__glyph">{maiden.name}</span>
      <span className="placeholder__tag">art in progress</span>
    </div>
  );
}

export function ComingSoon() {
  return (
    <div className="soon" aria-label="Coming soon">
      <span className="soon__stamp">Coming soon</span>
    </div>
  );
}
