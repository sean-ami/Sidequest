import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { HoloCard } from "../components/HoloCard";
import { ParallaxScene } from "../components/ParallaxScene";
import { StationDial } from "../components/StationDial";
import { MAIDENS } from "../data/maidens";
import { useStation } from "../lib/station";
import { useTitle } from "../lib/useTitle";
import { go } from "../lib/paths";

const ForgeCanvas = lazy(() => import("../components/ForgeCanvas"));

export function Home() {
  useTitle();
  const { current } = useStation();

  return (
    <>
      <section className="hero">
        <div className="hero__canvas">
          <Suspense fallback={<div className="hero__fallback" />}>
            <ForgeCanvas />
          </Suspense>
        </div>
        <div className="hero__copy">
          <span className="eyebrow">Side Quest Lo-Fi · Maidens · Cards</span>
          <h1>
            Nine Maidens.
            <br />
            Nine stations.
            <br />
            <em>Made here.</em>
          </h1>
          <p>Original characters and original lo-fi. Animated scenes to study, code and sleep to, and the art you can take home.</p>
          <div className="cta-row">
            <a href="#tuner" className="btn btn--primary">Tune in</a>
            <Link to="/maidens" className="btn">Meet the Maidens</Link>
          </div>
        </div>
        <span className="hero__scroll mono" aria-hidden="true">scroll ↓</span>
      </section>

      <section id="tuner" className="tuner">
        <div className="tuner__head">
          <span className="eyebrow">The stations</span>
          <h2>Spin the dial. Each Maiden hosts a mood.</h2>
        </div>
        <div className="tuner__grid">
          <StationDial />
          <div className="tuner__stage">
            <ParallaxScene key={current.slug} maiden={current} className="scene--framed" />
            <div className="tuner__caption">
              <div>
                <strong>{current.station}</strong> with {current.name}
                <p>{current.tagline}</p>
                {current.slug === "vega" && <p className="hint">Tip: pop her bubble.</p>}
              </div>
              <Link to={`/${current.slug}`} className="btn">Visit station →</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="cast">
        <div className="section-head">
          <span className="eyebrow">The cast</span>
          <h2>Collect the Side Quest Maidens</h2>
          <Link to="/maidens" className="link">All nine →</Link>
        </div>
        <div className="cast__row">
          {MAIDENS.filter((m) => m.priority === 1).map((m, i) => (
            <HoloCard key={m.slug} maiden={m} index={i} />
          ))}
        </div>
      </section>

      <section className="pillars">
        <article>
          <span className="pillar__num mono">01</span>
          <h3>Lo-fi stations</h3>
          <p>Three-hour mixes with characters who actually move: Briar's lightning, Vega's bubble, Nova's dash. Original music, no claims.</p>
          <a href={go("youtube")} className="link">Side Quest Lo-Fi ↗</a>
        </article>
        <article>
          <span className="pillar__num mono">02</span>
          <h3>Desk mats &amp; posters</h3>
          <p>Every station scene is composed for print, so the mat under your keyboard is the same world playing on your screen.</p>
          <Link to="/shop" className="link">The shop →</Link>
        </article>
        <article>
          <span className="pillar__num mono">03</span>
          <h3>Live card breaks</h3>
          <p>Original Maiden trading cards, opened live. Follow along to catch the first show.</p>
          <Link to="/live" className="link">Live schedule →</Link>
        </article>
      </section>
    </>
  );
}
