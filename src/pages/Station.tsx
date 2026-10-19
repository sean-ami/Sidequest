import { useEffect, useRef, type CSSProperties } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { LatestMix } from "../components/LatestMix";
import { ParallaxScene } from "../components/ParallaxScene";
import { ProductMocks } from "../components/ProductMocks";
import { bySlug, MAIDENS } from "../data/maidens";
import { useStation } from "../lib/station";
import { useTitle } from "../lib/useTitle";
import { NotFound } from "./NotFound";
import { go } from "../lib/paths";
import { sourceFor, track } from "../lib/track";

export function Station() {
  const { slug } = useParams();
  const maiden = bySlug(slug?.toLowerCase());
  const { tune, audioOn, toggleAudio } = useStation();
  useTitle(maiden ? `${maiden.station} with ${maiden.name}` : "Not found");

  useEffect(() => {
    if (maiden) tune(maiden);
  }, [maiden, tune]);

  // One "visit" per station view, attributed to the ?v= tag from the video description.
  const { pathname, search } = useLocation();
  const src = useRef("");
  const counted = useRef("");
  useEffect(() => {
    if (!maiden || counted.current === maiden.slug) return;
    counted.current = maiden.slug;
    src.current = sourceFor(pathname, search);
    track(maiden.slug, "visit", src.current);
  }, [maiden]);

  if (!maiden) return <NotFound />;

  const i = MAIDENS.indexOf(maiden);
  const prev = MAIDENS[(i - 1 + MAIDENS.length) % MAIDENS.length];
  const next = MAIDENS[(i + 1) % MAIDENS.length];

  return (
    <>
      <section className="station-hero">
        <ParallaxScene key={maiden.slug} maiden={maiden} className="scene--full" />
        <div className="station-hero__copy">
          <span className="mono">FM {maiden.freq} · {maiden.genre}{maiden.live ? "" : " · Coming soon"}</span>
          <h1>{maiden.station}</h1>
          <p>with {maiden.name}. {maiden.tagline}</p>
          <div className="cta-row">
            <button className={`btn btn--primary ${audioOn ? "is-on" : ""}`} onClick={toggleAudio}>
              {audioOn ? "◼ Stop the radio" : "▶ Play station ambience"}
            </button>
            {maiden.live ? (
              <a
                href={maiden.youtube ? `https://www.youtube.com/playlist?list=${maiden.youtube.playlist}` : go("youtube")}
                className="btn"
                target="_blank"
                rel="noopener"
                onClick={() => track(maiden.slug, maiden.youtube ? "playlist" : "youtube", src.current || "direct")}
              >
                Full 3-hour mixes ↗
              </a>
            ) : (
              <span className="btn btn--static">Station launching soon</span>
            )}
          </div>
        </div>
      </section>

      <section className="station-info">
        <dl className="stats">
          <div><dt>Tempo</dt><dd>{maiden.bpm[0]}–{maiden.bpm[1]} BPM</dd></div>
          <div><dt>Made for</dt><dd>{maiden.use}</dd></div>
          <div><dt>Signature</dt><dd>{maiden.signature ?? "In progress"}</dd></div>
        </dl>
      </section>

      <LatestMix maiden={maiden} src={() => src.current || "direct"} />

      <section className="collection">
        <div className="section-head">
          <span className="eyebrow">{maiden.name}'s collection</span>
          <h2>Take the station home</h2>
        </div>
        <ProductMocks maiden={maiden} />
        <p className="note">The shop opens with the new art. <Link to="/live">Follow along</Link> to hear first.</p>
      </section>

      <nav className="station-nav" aria-label="Other stations">
        <Link to={`/${prev.slug}`} style={{ "--m": prev.color } as CSSProperties}>← {prev.station}</Link>
        <Link to="/maidens">All Maidens</Link>
        <Link to={`/${next.slug}`} style={{ "--m": next.color } as CSSProperties}>{next.station} →</Link>
      </nav>
    </>
  );
}
