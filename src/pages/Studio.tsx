import { useEffect, useState } from "react";
import { MAIDENS } from "../data/maidens";
import { ParallaxScene } from "../components/ParallaxScene";

/** Internal: check each station render against the locked print crops (§11). Not linked; disallowed in robots.txt. */
export function Studio() {
  const [guides, setGuides] = useState(true);
  useEffect(() => {
    document.title = "Studio · crop check";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  return (
    <section className="page">
      <div className="page__head">
        <span className="eyebrow">Studio</span>
        <h1>Print crop check</h1>
        <p>Keep the figure, her face and every signature element inside the dashed safe area. Solid frames show the 2:1 desk mat and 3:2 poster crops of the 16:9 master. Maidens with only a portrait render are left out until their scene exists.</p>
        <label className="toggle">
          <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} /> Show guides
        </label>
      </div>
      <div className="studio">
        {MAIDENS.filter((m) => m.art && !m.art.portrait).map((m) => (
          <figure key={m.slug}>
            <ParallaxScene maiden={m} guides={guides} className="scene--framed" />
            <figcaption>{m.name} · {m.station}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
