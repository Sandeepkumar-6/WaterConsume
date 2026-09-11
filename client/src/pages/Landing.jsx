import { Link } from "react-router-dom";
import {
  ArrowRight,
  Droplets,
  Leaf,
  Building2,
  ClipboardList,
  ChartNoAxesCombined,
  ShieldCheck,
  Check,
} from "lucide-react";
import campusConservation from "../assets/campus-water-conservation.svg";
import tapAwareness from "../assets/tap-awareness.svg";

export default function Landing() {
  return (
    <div className="landing">
      <nav className="landing-nav" aria-label="Public navigation">
        <Link className="brand" to="/">
          <span className="brand-icon">
            <Droplets size={25} />
          </span>
          <span>
            smart<span className="brand-water">water</span>
            <small>CAMPUS WATER CONSERVATION</small>
          </span>
        </Link>
        <div className="landing-nav-links">
          <a href="#purpose">Our purpose</a>
          <a href="#how-it-works">How it works</a>
          <Link className="button" to="/login">
            Open portal <ArrowRight size={17} />
          </Link>
        </div>
      </nav>
      <main className="landing-main">
        <section className="hero">
          <div className="hero-copy">
            <span className="hero-kicker">
              <Leaf size={15} /> A WATER-WISE CAMPUS STARTS WITH US
            </span>
            <h1>
              Every drop.
              <br />
              Every building.
              <br />
              <em>A better tomorrow.</em>
            </h1>
            <p>Smart Water Consumption &amp; Conservation Portal</p>
            <p className="hero-description">
              From the hostel washroom to the laboratory tap, understand your
              institution’s water use and make conservation part of everyday
              campus life.
            </p>
            <div className="hero-actions">
              <Link className="button" to="/login">
                Sign in to your campus <ArrowRight size={18} />
              </Link>
              <a className="hero-about" href="#how-it-works">
                Explore the portal <ArrowRight size={16} />
              </a>
            </div>
            <div className="hero-note">
              <ShieldCheck size={17} /> One shared workspace for administrators
              and staff
            </div>
          </div>
          <figure className="hero-visual">
            <img
              src={campusConservation}
              width="720"
              height="600"
              fetchPriority="high"
              alt="A hand turns off a brass tap at a tiled water point on an Indian college campus"
            />
            <figcaption>
              <span className="caption-check">
                <Check size={19} />
              </span>
              <div>
                <strong>Conservation begins at the tap.</strong>
                <span>Close it fully. Report a leak. Make it a habit.</span>
              </div>
            </figcaption>
          </figure>
        </section>
        <div className="campus-strip">
          <span>
            <Building2 size={19} /> Built for Indian colleges &amp; institutions
          </span>
          <span>
            <ClipboardList size={18} /> Manual records, meaningful insights
          </span>
          <span>
            <Leaf size={18} /> Everyday conservation
          </span>
        </div>
        <section className="landing-workflow" id="how-it-works">
          <div className="landing-section-heading">
            <div>
              <span className="eyebrow">
                FROM A RECORD TO A RESPONSIBLE ACTION
              </span>
              <h2>A clearer view. A more careful campus.</h2>
            </div>
            <p>
              Simple tools for the people who manage water across your
              institution.
            </p>
          </div>
          <div className="feature-grid">
            {[
              [
                ClipboardList,
                "01",
                "Record daily usage",
                "Log consumption by building, date, and responsible staff. Keep a reliable history in one place.",
              ],
              [
                ChartNoAxesCombined,
                "02",
                "See the bigger picture",
                "Compare campus areas, review trends, and understand usage against daily and monthly limits.",
              ],
              [
                Leaf,
                "03",
                "Take informed action",
                "Review limit alerts, follow up on unusual usage, and share reports with your campus team.",
              ],
            ].map(([Icon, step, title, description]) => (
              <article className="panel" key={step}>
                <div className="feature-top">
                  <span className="feature-icon">
                    <Icon size={23} />
                  </span>
                  <span>{step}</span>
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-purpose" id="purpose">
          <div className="purpose-art">
            <img
              src={tapAwareness}
              width="320"
              height="240"
              loading="lazy"
              alt="A brass tap and water drop above a tiled institutional wash basin"
            />
          </div>
          <div>
            <span className="eyebrow">
              SMALL ACTIONS. SHARED RESPONSIBILITY.
            </span>
            <h2>
              Every drop counts.
              <br />
              So does every action.
            </h2>
            <p>
              Regular monitoring helps your team notice unusual water use. Pair
              it with everyday checks: close taps after use, report possible
              leaks, and avoid unnecessary running water.
            </p>
            <Link className="text-link" to="/login">
              Start with your campus records <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <span>Smart Water Consumption &amp; Conservation Portal</span>
        <span>A college project with a shared purpose.</span>
      </footer>
    </div>
  );
}
