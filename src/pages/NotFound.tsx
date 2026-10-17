import { Link } from "react-router-dom";
import { useTitle } from "../lib/useTitle";

export function NotFound() {
  useTitle("Off the map");
  return (
    <section className="page page--narrow notfound">
      <span className="mono">404 · static on this frequency</span>
      <h1>This quest isn't on the map.</h1>
      <Link to="/" className="btn btn--primary">Back to the stations</Link>
    </section>
  );
}
