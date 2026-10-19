import { useState } from "react";
import type { Maiden } from "../data/maidens";
import { track } from "../lib/track";

/** Newest mix as a click-to-load YouTube player: no YouTube scripts or cookies until someone presses play. */
export function LatestMix({ maiden, src }: { maiden: Maiden; src: () => string }) {
  const [playing, setPlaying] = useState(false);
  const yt = maiden.youtube;
  if (!yt?.videos.length) return null;
  const video = yt.videos[0];

  return (
    <section className="mix">
      <div className="section-head">
        <span className="eyebrow">Latest mix</span>
        <h2>{video.title}</h2>
      </div>
      <div className="mix__player">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&list=${yt.playlist}`}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <button
            className="mix__poster"
            onClick={() => {
              track(maiden.slug, "video", src());
              setPlaying(true);
            }}
            aria-label={`Play ${video.title}`}
          >
            <img src={`https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`} alt="" loading="lazy" />
            <span className="mix__play" aria-hidden="true">▶</span>
          </button>
        )}
      </div>
      <a
        className="link"
        href={`https://www.youtube.com/playlist?list=${yt.playlist}`}
        target="_blank"
        rel="noopener"
        onClick={() => track(maiden.slug, "playlist", src())}
      >
        All of {maiden.name}'s mixes on YouTube ↗
      </a>
    </section>
  );
}
