import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ProductMocks } from "../components/ProductMocks";
import { MAIDENS } from "../data/maidens";
import { EMAIL } from "../lib/paths";
import { useTitle } from "../lib/useTitle";

export function Shop() {
  useTitle("Shop");
  const featured = MAIDENS[1];
  return (
    <section className="page">
      <div className="page__head">
        <span className="eyebrow">The shop</span>
        <h1>Opening soon</h1>
        <p>Desk mats, posters and stickers cut from the same scenes that play on the stations. Printed in-house by our print partner, so colours match across a set.</p>
      </div>
      <ProductMocks maiden={featured} />
      <h2 className="subhead">Collections</h2>
      <ul className="collections">
        {MAIDENS.map((m) => (
          <li key={m.slug}>
            <Link to={`/${m.slug}`} style={{ "--m": m.color } as CSSProperties}>
              <strong>{m.name}</strong>
              <span>{m.station}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="note">
        Want to know when it opens, or have a question? Email <a href={`mailto:${EMAIL.hello}`}>{EMAIL.hello}</a>.
      </p>
    </section>
  );
}
