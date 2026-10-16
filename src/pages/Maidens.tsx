import { HoloCard } from "../components/HoloCard";
import { MAIDENS } from "../data/maidens";
import { useTitle } from "../lib/useTitle";

export function Maidens() {
  useTitle("The Maidens");
  return (
    <section className="page">
      <div className="page__head">
        <span className="eyebrow">Series 1</span>
        <h1>The Side Quest Maidens</h1>
        <p>Nine original characters, each the host of her own station. Hover to catch the foil; click a card to flip it.</p>
      </div>
      <div className="gallery">
        {MAIDENS.map((m, i) => (
          <HoloCard key={m.slug} maiden={m} index={i} />
        ))}
      </div>
    </section>
  );
}
