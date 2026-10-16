import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useStation } from "../lib/station";
import { Lockup } from "./GemMark";
import { go } from "../lib/paths";

export function Layout() {
  const { current, audioOn, toggleAudio } = useStation();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
      <header className="nav">
        <Link to="/" className="nav__home">
          <Lockup />
        </Link>
        <button className="nav__menu" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="nav-links">
          {open ? "Close" : "Menu"}
        </button>
        <nav id="nav-links" className={`nav__links ${open ? "is-open" : ""}`}>
          <NavLink to="/maidens">Maidens</NavLink>
          <NavLink to="/shop">Shop</NavLink>
          <NavLink to="/live">Live</NavLink>
          <a href={go("youtube")}>Lo-Fi ↗</a>
        </nav>
        <button className={`nav__radio ${audioOn ? "is-on" : ""}`} onClick={toggleAudio} aria-pressed={audioOn} title="Toggle station ambience">
          <span className="eq" aria-hidden="true"><i /><i /><i /></span>
          <span className="mono">{audioOn ? `FM ${current.freq}` : "Radio off"}</span>
        </button>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="footer__brand">
          <Lockup size="md" />
          <p>Original characters · original music. The Forge is where the Maidens were made.</p>
        </div>
        <nav className="footer__cols" aria-label="Footer">
          <div>
            <h4>Explore</h4>
            <Link to="/maidens">The Maidens</Link>
            <Link to="/shop">Shop</Link>
            <Link to="/live">Live shows</Link>
          </div>
          <div>
            <h4>Follow</h4>
            <a href={go("youtube")}>YouTube</a>
            <a href={go("instagram")}>Instagram</a>
            <a href={go("tiktok")}>TikTok</a>
            <a href={go("bluesky")}>Bluesky</a>
          </div>
          <div>
            <h4>Contact</h4>
            <a href="mailto:hello@sidequestforge.com">hello@sidequestforge.com</a>
          </div>
        </nav>
        <p className="footer__fine">
          © {new Date().getFullYear()} Side Quest Forge. Animation is AI-assisted; characters and music are our own.
        </p>
      </footer>
    </>
  );
}
