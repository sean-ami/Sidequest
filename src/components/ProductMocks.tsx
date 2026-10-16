import type { Maiden } from "../data/maidens";
import { Placeholder, PortraitComposite } from "./ParallaxScene";

const PRODUCTS = [
  { kind: "mat", name: "Desk mat", spec: "32 × 16 in · stitched edge" },
  { kind: "poster", name: "Poster", spec: "36 × 24 in · matte" },
  { kind: "sticker", name: "Sticker", spec: "3 in · holo vinyl" },
] as const;

/** Previews of a station scene as each product, cropped to the real print aspect ratios (§11). */
export function ProductMocks({ maiden }: { maiden: Maiden }) {
  const art = maiden.art;
  const pos = `${(art?.focus?.x ?? 0.5) * 100}% 40%`;
  return (
    <div className="products">
      {PRODUCTS.map((p) => (
        <article key={p.kind} className={`product product--${p.kind} ${art?.portrait ? "product--portrait" : ""}`}>
          <div className="product__img">
            {!art ? (
              <Placeholder maiden={maiden} />
            ) : art.portrait && p.kind === "mat" ? (
              <PortraitComposite maiden={maiden} />
            ) : (
              <img src={art.sceneSm} alt="" loading="lazy" style={{ objectPosition: art.portrait ? "50% 15%" : pos }} />
            )}
          </div>
          <div className="product__meta">
            <strong>{maiden.name} · {p.name}</strong>
            <span>{p.spec}</span>
            <span className="product__soon mono">Coming soon</span>
          </div>
        </article>
      ))}
    </div>
  );
}
