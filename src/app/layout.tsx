import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import "./board.css";
import PeriodTabs from "./period-tabs";

const SITE_URL = "https://cityweekend.lol";
const SITE_NAME = "City Weekend";
const SITE_DESCRIPTION =
  "Discover where to eat, drink and go in New York City this weekend on a transparent paid board. Rank is the bid.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "City Weekend — New York Weekend Board",
    template: "%s | City Weekend",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["New York weekend", "NYC things to do", "NYC restaurants", "NYC events"],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  icons: {
    icon: [{ url: "/brand-mark.svg", type: "image/svg+xml" }],
    shortcut: "/brand-mark.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: SITE_NAME,
    title: "City Weekend — New York Weekend Board",
    description: SITE_DESCRIPTION,
    images: [{ url: "/brand-mark.png", width: 512, height: 512, alt: "City Weekend poster" }],
  },
  twitter: {
    card: "summary",
    title: "City Weekend — New York Weekend Board",
    description: SITE_DESCRIPTION,
    images: ["/brand-mark.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: "en",
  isAccessibleForFree: true,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
              const key = "city-weekend-theme";
              const root = document.documentElement;
              try {
                if (window.localStorage.getItem(key) === "dark") {
                  root.dataset.theme = "dark";
                }
              } catch {}
              document.addEventListener("click", (event) => {
                const target = event.target;
                if (!(target instanceof Element)) return;
                const toggle = target.closest("[data-theme-toggle]");
                if (!toggle) return;
                const dark = root.dataset.theme !== "dark";
                root.dataset.theme = dark ? "dark" : "light";
                try {
                  window.localStorage.setItem(key, dark ? "dark" : "light");
                } catch {}
                toggle.setAttribute("aria-pressed", String(dark));
                toggle.setAttribute("aria-label", dark ? "Use light theme" : "Use dark theme");
              });
            })();`,
          }}
        />
        <div className="sheet city-weekend-sheet">
          <header className="site-header" data-slot="site-header">
            <div className="site-header-inner" data-slot="shell">
              <div className="brand-period-group" data-slot="brand-period">
                <a
                  className="logo"
                  href="/"
                  aria-label="City Weekend home"
                  data-slot="brand"
                >
                  <img
                    className="brand-mark"
                    src="/brand-mark.svg"
                    width="26"
                    height="26"
                    alt=""
                    aria-hidden="true"
                  />
                  <span>city weekend</span>
                </a>
                <Suspense
                  fallback={
                    <div
                      className="period-pill"
                      role="tablist"
                      aria-label="Ranking period"
                      data-slot="period-tabs"
                      data-period-active="weekend"
                    >
                      <button
                        type="button"
                        className="period-pill-item is-active"
                        role="tab"
                        aria-selected="true"
                        tabIndex={0}
                        data-period-option="weekend"
                      >
                        Weekend
                      </button>
                      <button
                        type="button"
                        className="period-pill-item"
                        role="tab"
                        aria-selected="false"
                        tabIndex={-1}
                        data-period-option="rolling-7-days"
                      >
                        Rolling 7 days
                      </button>
                    </div>
                  }
                >
                  <PeriodTabs />
                </Suspense>
              </div>
              <nav className="site-nav" aria-label="Main" data-slot="primary-nav">
                <ul>
                  <li>
                    <a href="/">Board</a>
                  </li>
                  <li>
                    <a href="/about">About</a>
                  </li>
                  <li>
                    <a href="/rules">Rules</a>
                  </li>
                </ul>
              </nav>
              <div className="site-actions" data-slot="header-actions">
                <div
                  className="site-search"
                  role="search"
                  data-site-search=""
                  data-slot="search"
                >
                  <button
                    type="button"
                    className="search-button"
                    aria-label="Search venues"
                    aria-controls="site-search-popover"
                    aria-expanded="false"
                    aria-haspopup="dialog"
                    data-search-affordance=""
                  >
                    <span>Search</span>
                  </button>
                  <div
                    id="site-search-popover"
                    className="search-popover"
                    role="dialog"
                    aria-labelledby="site-search-title"
                    data-search-popover=""
                    hidden
                  >
                    <div className="search-popover-header">
                      <h2 id="site-search-title">Find a paid venue</h2>
                      <button
                        type="button"
                        className="search-close"
                        aria-label="Close search"
                        data-search-close=""
                      >
                        Close
                      </button>
                    </div>
                    <label
                      className="sr-only"
                      htmlFor="site-search-input"
                    >
                      Search paid venues on this page
                    </label>
                    <input
                      id="site-search-input"
                      className="search-input"
                      type="search"
                      placeholder="Search paid venues"
                      autoComplete="off"
                      spellCheck={false}
                      aria-describedby="site-search-status"
                      aria-controls="site-search-results"
                      data-search-input=""
                    />
                    <p
                      id="site-search-status"
                      className="search-status"
                      role="status"
                      aria-live="polite"
                      data-search-status=""
                    >
                      Search the paid venues shown on this page.
                    </p>
                    <ul
                      id="site-search-results"
                      className="search-results"
                      aria-label="Paid venue results"
                      data-search-results=""
                    />
                    <p className="search-empty" data-search-empty="" hidden>
                      No paid venues match this search.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="theme-toggle"
                  aria-label="Use dark theme"
                  aria-pressed="false"
                  data-theme-toggle=""
                >
                  <span>Theme</span>
                </button>
              </div>
            </div>
          </header>
          {children}
          <footer className="maker-footer" data-maker-contact="">
            <span>Built by </span>
            <a href="mailto:tangpingqingwa@gmail.com">tangpingqingwa@gmail.com</a>
          </footer>
          <script
            dangerouslySetInnerHTML={{
              __html: `(() => {
                const search = document.querySelector("[data-site-search]");
                if (!(search instanceof HTMLElement)) return;
                const toggle = search.querySelector("[data-search-affordance]");
                const popover = search.querySelector("[data-search-popover]");
                const input = search.querySelector("[data-search-input]");
                const results = search.querySelector("[data-search-results]");
                const status = search.querySelector("[data-search-status]");
                const empty = search.querySelector("[data-search-empty]");
                const closeButton = search.querySelector("[data-search-close]");
                if (!(toggle instanceof HTMLButtonElement) ||
                    !(popover instanceof HTMLElement) ||
                    !(input instanceof HTMLInputElement) ||
                    !(results instanceof HTMLUListElement) ||
                    !(status instanceof HTMLElement) ||
                    !(empty instanceof HTMLElement) ||
                    !(closeButton instanceof HTMLButtonElement)) return;

                let isOpen = false;

                function readListings() {
                  return Array.from(document.querySelectorAll("[data-listing-card]"))
                    .map((card) => {
                      if (!(card instanceof HTMLElement)) return null;
                      const link = card.querySelector("a[data-booking-url]");
                      const venue = card.querySelector("[data-venue]")?.textContent?.trim();
                      if (!(link instanceof HTMLAnchorElement) || !venue) return null;
                      const kind = card.querySelector("[data-kind]")?.textContent?.trim() || "";
                      const pitch = card.querySelector(".pitch")?.textContent?.trim() || "";
                      return {
                        id: card.getAttribute("data-listing-id") || "",
                        venue,
                        kind,
                        pitch,
                        href: link.getAttribute("href") || link.href,
                        searchable: [venue, kind, pitch].join(" ").toLowerCase(),
                      };
                    })
                    .filter((listing) => listing !== null);
                }

                function renderResults() {
                  const listings = readListings();
                  const query = input.value.trim().toLowerCase();
                  const matches = query
                    ? listings.filter((listing) => listing.searchable.includes(query))
                    : listings;
                  results.replaceChildren();
                  matches.forEach((listing) => {
                    const item = document.createElement("li");
                    const link = document.createElement("a");
                    link.className = "search-result-link";
                    link.href = listing.href;
                    link.dataset.searchResult = "";
                    if (listing.id) link.dataset.searchResultListingId = listing.id;
                    const name = document.createElement("span");
                    name.className = "search-result-name";
                    name.textContent = listing.venue;
                    link.append(name);
                    if (listing.kind) {
                      const detail = document.createElement("span");
                      detail.className = "search-result-kind";
                      detail.textContent = listing.kind;
                      link.append(detail);
                    }
                    item.append(link);
                    results.append(item);
                  });
                  results.hidden = matches.length === 0;
                  empty.hidden = matches.length > 0;
                  if (matches.length > 0) {
                    status.textContent = matches.length +
                      (matches.length === 1 ? " paid venue on this page." : " paid venues on this page.");
                  } else if (listings.length === 0) {
                    status.textContent = "No paid venues are listed on this page.";
                  } else if (query) {
                    status.textContent = "No paid venues match this search.";
                  } else {
                    status.textContent = "No paid venues are listed on this page.";
                  }
                }

                function setOpen(next, restoreFocus) {
                  isOpen = next;
                  toggle.setAttribute("aria-expanded", String(next));
                  popover.hidden = !next;
                  search.dataset.searchOpen = String(next);
                  if (next) {
                    renderResults();
                    input.focus({ preventScroll: true });
                  } else {
                    input.value = "";
                    renderResults();
                    if (restoreFocus) toggle.focus({ preventScroll: true });
                  }
                }

                toggle.addEventListener("click", () => setOpen(!isOpen, true));
                closeButton.addEventListener("click", () => setOpen(false, true));
                input.addEventListener("input", renderResults);
                search.addEventListener("keydown", (event) => {
                  if (event.key !== "Escape" || !isOpen) return;
                  event.preventDefault();
                  setOpen(false, true);
                });
                document.addEventListener("pointerdown", (event) => {
                  if (!isOpen || !(event.target instanceof Node) || search.contains(event.target)) return;
                  setOpen(false, false);
                });
                const board = document.querySelector("[data-board]");
                if (board instanceof HTMLElement && "MutationObserver" in window) {
                  new MutationObserver(() => {
                    if (isOpen) renderResults();
                  }).observe(board, { childList: true, subtree: true });
                }
              })();`,
            }}
          />
        </div>
      </body>
    </html>
  );
}
