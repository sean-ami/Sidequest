import { useTitle } from "../lib/useTitle";

export function Live() {
  useTitle("Live");
  return (
    <section className="page page--narrow">
      <div className="page__head">
        <span className="eyebrow">Live on Whatnot</span>
        <h1>Card breaks, opened live</h1>
        <p>Original Side Quest Maiden trading cards, pulled on stream. The first show will be announced here. Follow now so you don't miss it.</p>
      </div>
      <div className="live-card">
        <span className="mono">Next show</span>
        <strong>To be announced</strong>
        <a className="btn btn--primary" href="/go/whatnot">Follow on Whatnot ↗</a>
      </div>
      <p className="disclosure">
        Some links on this page are referral links. If you sign up through them we may receive a credit. That's paid promotion, and we want you to know.
      </p>
    </section>
  );
}
