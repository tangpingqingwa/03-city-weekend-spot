export const BOARD_CSS = /* css */ `
@font-face {
  font-family: "Outbid DM Sans";
  font-style: normal;
  font-weight: 100 1000;
  font-display: swap;
  src: url("/fonts/dm-sans-latin-variable.woff2") format("woff2");
}
:root {
  --background: #f4efe4;
  --foreground: #1c1914;
  --card: #fbf7ee;
  --primary: #9a3412;
  --primary-foreground: #fff8ef;
  --muted: #ebe3d4;
  --muted-foreground: #6b6256;
  --border: #d8cbb6;
  --input: #d8cbb6;
  --ring: #9a3412;
  --rule: #1c1914;
  --radius: 0.25rem;
  --font: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --serif: "Newsreader", "Iowan Old Style", "Palatino Linotype", Palatino, serif;
}
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
html {
  height: 100%;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
html::-webkit-scrollbar,
body::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}
body {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  scrollbar-width: none;
  -ms-overflow-style: none;
  font-family: var(--font);
  background:
    radial-gradient(900px 280px at 50% -120px, color-mix(in oklab, var(--primary) 10%, transparent), transparent),
    var(--background);
  color: var(--foreground);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
html,
body {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: hidden;
}
a { color: inherit; text-decoration: none; }
button, input { font: inherit; color: inherit; }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: 0.5; }
.site-header {
  width: 100%;
}
.site-header-inner,
.page {
  width: 100%;
  max-width: 56rem;
  margin: 0 auto;
  padding-left: 1rem;
  padding-right: 1rem;
}
.site-header-inner {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.75rem;
  padding-top: 0.85rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-family: var(--serif);
  font-size: 1.2rem;
  font-weight: 650;
  letter-spacing: -0.03em;
}
.brand-dot { color: var(--primary); }
.rail-folio {
  margin: 0;
  text-align: center;
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.rail-kicker {
  display: block;
  font-weight: 700;
  color: var(--primary);
}
.rail-folio time {
  display: block;
  margin-top: 0.15rem;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.08em;
}
@media (max-width: 640px) {
  .site-header-inner {
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "brand nav"
      "folio folio";
  }
  .brand { grid-area: brand; }
  .rail-folio { grid-area: folio; text-align: left; }
  .nav-wrap { grid-area: nav; }
}
.nav-wrap { display: flex; align-items: center; justify-content: flex-end; gap: 1rem; }
nav[aria-label="Main"] ul {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.875rem;
}
nav[aria-label="Main"] a {
  font-weight: 500;
  color: var(--muted-foreground);
}
nav[aria-label="Main"] a[aria-current="page"],
nav[aria-label="Main"] a:hover {
  color: var(--foreground);
}
.theme-toggle {
  width: 1.75rem;
  height: 1.75rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--foreground);
}
.theme-toggle:hover { background: var(--muted); }
.page {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-top: 1rem;
  padding-bottom: 4rem;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.masthead {
  margin: 0 0 1.75rem;
  padding: 1.35rem 0 1.15rem;
  border-bottom: 3px double var(--rule);
  text-align: center;
}
.masthead-kicker {
  margin: 0 0 0.35rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--primary);
}
.masthead-title {
  margin: 0;
  font-family: var(--serif);
  font-size: clamp(2.1rem, 6vw, 3.4rem);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 0.95;
}
.masthead-issue {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.45rem 0.7rem;
  margin: 0.85rem 0 0;
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.issue-label {
  font-weight: 700;
  color: var(--primary);
}
.masthead-issue time {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.issue-rule {
  width: 2.5rem;
  height: 1px;
  background: var(--border);
}
.issue-tz { color: var(--muted-foreground); }
.masthead-dek {
  margin: 0.55rem 0 0;
  color: var(--muted-foreground);
  font-size: 0.95rem;
}
.masthead-list {
  margin: 0.85rem 0 0;
  font-size: 0.9rem;
  color: var(--muted-foreground);
  text-wrap: pretty;
}
.list-under-cover {
  font-weight: 700;
  color: var(--primary);
  text-decoration: underline;
  text-decoration-style: dashed;
  text-underline-offset: 4px;
  text-decoration-thickness: 1px;
}
.list-under-cover:hover {
  color: var(--foreground);
}
#leaderboard { scroll-margin-top: 1.5rem; margin-top: 0; }
/* Empty morning: the direct Product URL, Why, Outbid form stays quiet. */
.desk:has(.empty) .cover-hop,
.desk:has(.empty) .cover-hop-wrap,
.desk:has(.empty) .cover-later,
.desk:has(.empty) .cover-why,
.desk:has(.empty) .list-under-cover,
.desk:has(.empty) .list-after-why,
.desk:has(.empty) .list-route,
.desk:has(.empty) .list-route-wrap,
.desk:has(.empty) .row-cover,
.desk:has(.empty) .later-stack,
.desk:has(.empty) .later-listing,
.desk:has(.empty) .why-first,
.desk:has(.empty) [data-list-land],
.desk:has(.empty) .later-rail,
.desk:has(.empty) [data-paid-name],
.desk:has(.empty) .claim-kicker,
.desk:has(.empty) .claim-after-cover,
.desk:has(.empty) .claim-after-row {
  display: none;
}
.desk:has(.empty) #claim .claim-title {
  font-size: clamp(2.1rem, 5vw, 2.85rem);
}
.last24h {
  margin-top: 1.75rem;
  padding-top: 1.15rem;
  border-top: 1px dashed var(--border);
}
.last24h-kicker {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.last24h-dek {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  color: var(--muted-foreground);
  text-wrap: pretty;
}
.last24h-empty {
  margin: 0.75rem 0 0;
  padding: 0.85rem 0.9rem;
  font-size: 0.875rem;
  color: var(--muted-foreground);
  border: 1px dashed var(--border);
}
.last24h-list {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
}
.last24h-row + .last24h-row { border-top: 1px solid var(--border); }
.last24h-link {
  display: flex;
  align-items: baseline;
  gap: 0.65rem;
  padding: 0.45rem 0;
}
.last24h-rank {
  flex-shrink: 0;
  min-width: 2.75rem;
  font-size: 0.75rem;
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.last24h-body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.last24h-host {
  font-family: var(--serif);
  font-size: 0.95rem;
  font-weight: 650;
}
.last24h-why {
  font-size: 0.8rem;
  color: var(--muted-foreground);
}
.last24h-meta {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: flex-end;
  gap: 0.45rem 0.65rem;
  font-size: 0.75rem;
  color: var(--muted-foreground);
}
.last24h-bid {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-decoration: underline;
  text-decoration-style: dashed;
  text-underline-offset: 3px;
}
.last24h-slot {
  margin: 0 0 0.15rem;
  font-family: var(--font);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.last24h-row[data-last24h-prize] .last24h-host {
  font-size: 0.95rem;
  font-weight: 650;
  letter-spacing: 0;
  line-height: 1.3;
}
.last24h-row[data-last24h-prize] .last24h-rank {
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.desk[data-two-prizes] .row-cover[data-morning-slot] .host[data-cover-name] {
  font-size: 1.85rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
}
.desk[data-two-prizes] .last24h-row[data-last24h-prize] .last24h-host {
  font-size: 0.88rem;
  font-weight: 500;
}
.desk[data-two-prizes] .last24h-row[data-last24h-prize] .last24h-rank {
  font-size: 0.62rem;
}
.desk[data-two-prizes] .row-cover[data-morning-slot][data-paid-name] .host[data-cover-name] {
  font-size: 1.85rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
}
#claim {
  scroll-margin-top: 1.5rem;
  margin-top: 2.25rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
}
/* Occupied morning: Take is the only first click. Claim #1 is a later write after the cover. */
.desk[data-occupied="true"] .claim-after-cover[data-claim-after-cover] {
  margin-top: 1.6rem;
}
.desk[data-occupied="true"] .claim-after-cover[data-claim-after-cover] #claim {
  margin-top: 0;
  padding-top: 1.1rem;
  border-top: 1px dashed var(--border);
}
.desk[data-occupied="true"] .claim-after-cover[data-claim-after-cover] #claim .claim-title {
  font-size: 1.15rem;
  font-weight: 500;
  letter-spacing: 0;
}
@media (min-width: 768px) {
  .desk[data-occupied="true"] .claim-after-cover[data-claim-after-cover] #claim .claim-title {
    font-size: 1.25rem;
  }
}
.desk[data-occupied="true"] .claim-after-cover[data-claim-after-cover] #claim .outbid {
  height: 2.2rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.desk[data-occupied="true"] .claim-after-cover[data-claim-after-cover] #claim .bid-field {
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}
/* Empty morning: Product URL and Why lead directly to one Outbid submit. */
.desk[data-occupied="false"] #claim {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
.desk[data-occupied="false"] #claim .bid-form {
  width: 100%;
  align-items: center;
}
.desk[data-occupied="false"] #claim .field {
  width: 100%;
  max-width: 28rem;
}
.desk[data-occupied="false"] #claim .outbid {
  width: auto;
  min-width: 9rem;
  margin: 0 auto;
}
.claim-kicker {
  margin: 0 0 0.45rem;
  text-align: center;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.claim-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem 0.5rem;
  margin: 0;
  text-align: center;
  font-family: var(--serif);
  font-size: 1.75rem;
  font-weight: 650;
  letter-spacing: -0.03em;
  text-wrap: pretty;
}
@media (min-width: 768px) {
  .claim-title { font-size: 2.5rem; }
}
.bid-stepper { display: inline-flex; align-items: center; gap: 0.5rem; }
.step {
  width: 1.5rem;
  height: 1.5rem;
  border: 1px solid color-mix(in oklab, var(--primary) 35%, transparent);
  border-radius: 2px;
  background: color-mix(in oklab, var(--primary) 10%, transparent);
  color: var(--primary);
  font-weight: 700;
  font-size: 0.875rem;
  line-height: 1;
}
.step:hover {
  background: color-mix(in oklab, var(--primary) 25%, transparent);
}
.bid-field {
  position: relative;
  display: inline-block;
  color: var(--primary);
  text-decoration: underline;
  text-decoration-style: dashed;
  text-underline-offset: 6px;
  text-decoration-thickness: 2px;
}
.bid-field:focus-within {
  outline: 2px solid var(--ring);
  outline-offset: 4px;
  border-radius: 2px;
}
.bid-sizer {
  visibility: hidden;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.bid-input-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: baseline;
}
.bid-input-wrap input {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 0;
  outline: none;
  font: inherit;
  letter-spacing: inherit;
  font-variant-numeric: tabular-nums;
}
.claim-note {
  margin: 0.5rem auto 0;
  max-width: 28rem;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.625;
  color: var(--muted-foreground);
  text-wrap: pretty;
}
.claim-note .accent { color: color-mix(in oklab, var(--primary) 70%, transparent); }
/* Unpaid Waffo checkout stays off the merch desk until Waffo reports paid. */
.desk[data-unpaid-off] .row-cover,
.desk[data-unpaid-off] .later-stack,
.desk[data-unpaid-off] .cover-hop,
.desk[data-unpaid-off] .cover-hop-wrap,
.desk[data-unpaid-off] .cover-later,
.desk[data-unpaid-off] .cover-why,
.desk[data-unpaid-off] .list-under-cover,
.desk[data-unpaid-off] .list-after-why,
.desk[data-unpaid-off] .list-route,
.desk[data-unpaid-off] .list-route-wrap,
.desk[data-unpaid-off] .later-listing,
.desk[data-unpaid-off] .why-first,
.desk[data-unpaid-off] [data-list-land],
.desk[data-unpaid-off] .later-rail,
.desk[data-unpaid-off] .claim-kicker,
.desk[data-unpaid-off] .claim-after-cover,
.desk[data-unpaid-off] .claim-after-row {
  display: none;
}
.claim-note[data-unpaid-off] {
  max-width: 32rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--foreground);
}
.claim-note[data-unpaid-off] .unpaid-off-line {
  display: block;
  margin: 0 0 0.45rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--foreground);
}
.desk[data-occupied="false"] #claim .claim-note[data-unpaid-off] {
  max-width: 26rem;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--muted-foreground);
}
.desk[data-occupied="false"] #claim .claim-note[data-unpaid-off] .unpaid-off-line {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--muted-foreground);
}
.bid-form {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.field {
  position: relative;
  min-width: 0;
  flex: 1;
}
.field-label {
  display: block;
  margin: 0 0 0.3rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.field input,
.field textarea {
  width: 100%;
  min-width: 0;
  height: 2.75rem;
  border: 1px solid var(--input);
  border-radius: 2px;
  background: var(--card);
  padding: 0.25rem 0.75rem;
  outline: none;
}
.field textarea {
  height: auto;
  min-height: 2.75rem;
  resize: vertical;
  padding-top: 0.7rem;
}
.field input:focus,
.field textarea:focus {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent);
}
.field input::placeholder,
.field textarea::placeholder { color: var(--muted-foreground); }
.why-field input { padding-left: 0.75rem; }
.outbid {
  height: 2.75rem;
  width: 100%;
  flex-shrink: 0;
  align-self: flex-end;
  border: 0;
  border-radius: 2px;
  background: var(--primary);
  color: var(--primary-foreground);
  font-weight: 700;
  font-size: 0.875rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0 1.25rem;
}
@media (min-width: 768px) {
  .outbid { width: auto; }
}
.outbid:hover { background: color-mix(in oklab, var(--primary) 80%, black); }
.form-hint {
  margin: 0;
  text-align: center;
  font-size: 0.75rem;
  line-height: 1.625;
  color: var(--muted-foreground);
  text-wrap: pretty;
}
.empty {
  margin-top: 0.25rem;
  padding: 2.4rem 1.25rem;
  text-align: center;
  color: var(--muted-foreground);
  border: 1px dashed var(--border);
  background: color-mix(in oklab, var(--card) 70%, transparent);
}
.empty-kicker {
  margin: 0 0 0.45rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--primary);
}
.empty strong { color: var(--foreground); }
.row {
  position: relative;
  padding: 0 0.75rem;
}
@media (min-width: 768px) {
  .row { padding: 0 1rem; }
}
.row + .row { border-top: 1px solid var(--border); }
.row-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
}
a.row-link { text-decoration: none; }
@media (min-width: 768px) {
  .row-link { gap: 0.75rem; padding: 0.75rem 0; }
}
a.row-link:hover { color: var(--primary); }
.row-meta {
  display: flex;
  width: 2.5rem;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
}
.row-kicker {
  margin: 0 0 0.2rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--primary);
}
.cover-hop-wrap {
  margin: 0.15rem 0 0.7rem;
}
.cover-hop {
  display: inline-flex;
  align-items: center;
  height: 2.25rem;
  padding: 0 0.95rem;
  border: 0;
  border-radius: 2px;
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: none;
}
.cover-hop-first {
  min-height: 2.75rem;
  height: auto;
  padding: 0.55rem 1.15rem;
  font-size: 0.95rem;
  letter-spacing: 0.1em;
  box-shadow: 0.22rem 0.22rem 0 0 color-mix(in oklab, var(--primary) 45%, transparent);
}
.cover-hop:hover {
  background: color-mix(in oklab, var(--primary) 80%, black);
  color: var(--primary-foreground);
}
.cover-why {
  margin: 0.15rem 0 0.35rem;
}
.cover-why-label {
  margin: 0 0 0.25rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.cover-why-line {
  margin: 0;
  font-family: var(--serif);
  font-size: 1.2rem;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.3;
  color: var(--foreground);
  text-wrap: pretty;
}
.cover-why-line[data-prize-before-price] {
  font-size: 1.85rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
}
.list-after-why-wrap {
  margin: 0.5rem 0 0;
  font-size: 0.9rem;
  font-family: var(--font);
  font-weight: 500;
  letter-spacing: 0;
  line-height: 1.45;
  text-transform: none;
  color: var(--muted-foreground);
  text-wrap: pretty;
}
.list-after-why {
  font-weight: 700;
  color: var(--primary);
  text-decoration: underline;
  text-decoration-style: dashed;
  text-underline-offset: 4px;
  text-decoration-thickness: 1px;
}
.list-after-why:hover {
  color: var(--foreground);
}
.cover-why + .cover-hop-wrap {
  margin-top: 0;
}
/* Occupied cover: Take is the one first click. List stays a quiet route after it. */
.list-route-wrap {
  margin: 0.35rem 0 0.7rem;
  font-size: 0.9rem;
  font-family: var(--font);
  font-weight: 500;
  letter-spacing: 0;
  line-height: 1.45;
  text-transform: none;
  color: var(--muted-foreground);
  text-wrap: pretty;
}
.list-route {
  font-weight: 700;
  color: var(--primary);
  text-decoration: underline;
  text-decoration-style: dashed;
  text-underline-offset: 4px;
  text-decoration-thickness: 1px;
}
.list-route:hover {
  color: var(--foreground);
}
.desk[data-occupied="true"] .list-route-wrap[data-list-route-wrap] {
  margin: 0.25rem 0 0;
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--muted-foreground);
}
.desk[data-occupied="true"] .list-route-wrap[data-list-route-wrap] .list-route {
  display: inline;
  min-height: 0;
  height: auto;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: none;
  box-shadow: none;
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: none;
  text-decoration: underline;
  text-decoration-style: dashed;
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  color: var(--muted-foreground);
  vertical-align: baseline;
}
.desk[data-occupied="true"] .list-route-wrap[data-list-route-wrap] .list-route:hover {
  background: none;
  color: var(--foreground);
}
@media (min-width: 768px) {
  .row-meta {
    width: auto;
    flex-direction: row;
    gap: 0.75rem;
  }
}
.rank {
  display: inline-flex;
  min-width: 1.75rem;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--muted-foreground);
}
@media (min-width: 768px) {
  .rank { min-width: 2.5rem; font-size: 1rem; }
}
.row-body { min-width: 0; flex: 1; }
.row-top {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}
.host {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--serif);
  font-size: 1rem;
  font-weight: 650;
}
.bid {
  flex-shrink: 0;
  font-size: 0.875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--primary);
}
@media (min-width: 768px) {
  .host, .bid { font-size: 1rem; }
}
.blurb {
  margin: 0.15rem 0 0;
  min-width: 0;
  font-size: 0.875rem;
  color: color-mix(in oklab, var(--muted-foreground) 85%, var(--foreground));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (min-width: 768px) {
  .blurb {
    font-size: 0.875rem;
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}
.row-foot {
  margin-top: 0.125rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 0.375rem;
  font-size: 0.6875rem;
}
@media (min-width: 768px) {
  .row-foot { font-size: 0.75rem; }
}
.when { color: color-mix(in oklab, var(--muted-foreground) 70%, transparent); }
.clicks {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 600;
}
.claim-rank {
  display: inline;
  margin: 0;
  border: 0;
  padding: 0;
  background: none;
  color: var(--muted-foreground);
  font-size: 0.58rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-decoration: underline;
  text-decoration-style: dashed;
  text-underline-offset: 3px;
  white-space: nowrap;
}
.claim-rank:hover,
.claim-rank:focus {
  color: var(--foreground);
}
.row-cover {
  margin: 0 0 1rem;
  padding: 0.85rem 0.85rem 0.65rem;
  border: 1px solid var(--rule);
  background: var(--card);
  box-shadow: 0.4rem 0.4rem 0 0 color-mix(in oklab, var(--primary) 18%, transparent);
}
.row-cover + .row { border-top: 0; }
.later-stack {
  margin: 0 0 0.35rem;
  padding: 0.65rem 0.15rem 0.15rem;
  border-top: 1px dashed var(--border);
}
.later-stack-kicker {
  margin: 0 0 0.2rem;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.later-stack-dek {
  margin: 0 0 0.35rem;
  font-size: 0.8rem;
  color: var(--muted-foreground);
  text-wrap: pretty;
}
.later-stack[data-later-stack] .row[data-later-rank] {
  display: flex;
  flex-direction: column;
  padding-left: 0;
  padding-right: 0;
}
.later-stack[data-later-stack] .row[data-later-rank] + .row[data-later-rank] {
  border-top: 1px dashed var(--border);
}
.later-listing[data-later-listing] {
  margin-top: 0.15rem;
}
.later-listing[data-later-listing] .field-label {
  font-size: 0.58rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  color: var(--muted-foreground);
}
.later-listing[data-later-listing] .field input {
  height: 1.85rem;
  font-size: 0.78rem;
  color: var(--muted-foreground);
}
/* Occupied listing field after List is Why — the prize line, not a second generic line. */
.desk[data-occupied="true"] .why-first[data-why-first] .why-field[data-prize-line] .field-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.desk[data-occupied="true"] .why-first[data-why-first] .why-field[data-prize-line] input {
  height: 2.25rem;
  font-family: var(--serif);
  font-size: 1.05rem;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--foreground);
}
/* Occupied write after List starts at Why — the prize line, not Product URL first. */
.desk[data-occupied="true"] .why-first[data-why-first] {
  margin: 0 0 0.35rem;
}
/* Occupied List landing starts at Why — the prize line, not louder Claim #1 chrome first. */
.desk[data-occupied="true"] .why-first[data-why-first][data-list-land] {
  scroll-margin-top: 1.5rem;
  margin: 0 0 0.85rem;
}
.desk[data-occupied="true"] .why-first[data-why-first][data-list-land] .why-field[data-prize-line] input {
  height: 2.35rem;
  font-family: var(--serif);
  font-size: 1.05rem;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--foreground);
}
.desk[data-occupied="true"] .claim-after-cover[data-claim-after-cover] #claim .claim-title {
  font-size: 0.92rem;
  font-weight: 500;
  letter-spacing: 0;
}
@media (min-width: 768px) {
  .desk[data-occupied="true"] .claim-after-cover[data-claim-after-cover] #claim .claim-title {
    font-size: 0.95rem;
  }
}
/* Occupied claim rail after Why land is later rail — quieter than Why, not a second first read. */
.desk[data-occupied="true"] .later-rail[data-later-rail] {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  margin: 0.1rem 0 0;
  padding-top: 0.55rem;
  border-top: 1px dotted var(--border);
}
.desk[data-occupied="true"] #claim .later-rail[data-later-rail] .claim-title {
  font-size: 0.78rem;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--muted-foreground);
}
@media (min-width: 768px) {
  .desk[data-occupied="true"] #claim .later-rail[data-later-rail] .claim-title {
    font-size: 0.82rem;
  }
}
.desk[data-occupied="true"] #claim .later-rail[data-later-rail] .outbid {
  height: 1.85rem;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.desk[data-occupied="true"] #claim .later-rail[data-later-rail] .bid-field {
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
.desk[data-occupied="true"] #claim .later-rail[data-later-rail] .claim-note {
  margin-top: 0.1rem;
  font-size: 0.68rem;
  font-weight: 500;
}
.desk[data-occupied="true"] #claim .later-rail[data-later-rail] .bid-form {
  margin-top: 0.25rem;
  width: 100%;
}
.desk[data-occupied="true"] #claim .later-rail[data-later-rail] .step {
  width: 1.15rem;
  height: 1.15rem;
  font-size: 0.7rem;
}
/* Occupied Product URL after later claim rail is later write — not a twin on the bid-row. */
.desk[data-occupied="true"] .visual-home #claim .later-rail[data-later-rail] + .later-listing[data-later-listing] {
  display: none;
  flex-direction: column;
  width: 100%;
  max-width: 14.5rem;
  margin: 0.55rem auto 0;
  padding-top: 0.5rem;
  border-top: 1px dotted var(--border);
}
.desk[data-occupied="true"] #claim .later-rail[data-later-rail] + .later-listing[data-later-listing] .field-label {
  font-size: 0.5rem;
  font-weight: 500;
  letter-spacing: 0.08em;
}
.desk[data-occupied="true"] #claim .later-rail[data-later-rail] + .later-listing[data-later-listing] .field input {
  height: 1.35rem;
  font-size: 0.58rem;
  color: var(--muted-foreground);
}
/* Occupied later merch: claim-this-rank is a quieter later write after the product, not a filled pill on the name. */
.later-stack[data-later-stack] .row[data-later-rank] .claim-after-row[data-claim-after-row] {
  margin: 0 0 0.2rem;
  padding: 0 0 0.05rem 1.85rem;
  font-size: 0.58rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--muted-foreground);
}
.later-stack[data-later-stack] .row[data-later-rank] .claim-after-row[data-claim-after-row] .claim-rank {
  font-size: 0.58rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--muted-foreground);
}
.row-1 .rank {
  min-width: 1.75rem;
  border-radius: 2px;
  background: var(--primary);
  color: var(--primary-foreground);
  font-weight: 700;
  padding: 0.1rem 0.375rem;
}
.row-cover .host {
  font-size: 1.25rem;
  white-space: normal;
}
.row-cover .host[data-cover-name] {
  font-size: 1.85rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
}
.row-cover[data-paid-name] .host[data-cover-name] {
  font-size: 1.85rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
}
.desk[data-occupied="true"] .row-cover[data-paid-name] .host[data-cover-name] {
  font-size: 1.85rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
}
.row-cover .bid {
  font-size: 0.8rem;
}
.row-cover .clicks {
  font-size: 0.7rem;
}
.cover-later[data-later-fact] {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.65rem;
  margin: 0.2rem 0 0;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--muted-foreground);
  letter-spacing: 0.02em;
}
.row-cover .bid.later-fact[data-later-fact],
.cover-later[data-later-fact] .bid.later-fact,
.cover-later[data-later-fact] .clicks.later-fact {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--muted-foreground);
}
.row-cover .row-link { padding-bottom: 0.35rem; }
.row-stack { padding-left: 0.25rem; }
@media (min-width: 768px) {
  .row-cover { padding: 1.1rem 1.15rem 0.85rem; }
}
.band {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem 0.75rem;
}
.band-line {
  height: 2px;
  flex: 1;
  border-radius: 999px;
  background: color-mix(in oklab, var(--primary) 30%, transparent);
}
.band-label {
  border: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
  background: color-mix(in oklab, var(--primary) 10%, transparent);
  color: var(--primary);
  border-radius: 999px;
  padding: 0.25rem 0.625rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.025em;
  text-transform: uppercase;
}
.doc {
  max-width: 42rem;
  margin: 0 auto;
}
.doc h1 {
  margin: 0 0 1rem;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}
.doc h2 {
  margin: 2rem 0 0.75rem;
  font-size: 1.125rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.doc p, .doc li {
  color: var(--muted-foreground);
}
.doc p { margin: 0 0 0.85rem; }
.doc ol, .doc ul {
  margin: 0 0 0.85rem;
  padding-left: 1.25rem;
}
.doc li { margin: 0.35rem 0; }
.doc strong { color: var(--foreground); }
.doc a {
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.doc code {
  font-size: 0.875em;
  background: var(--muted);
  border-radius: 0.35rem;
  padding: 0.1rem 0.35rem;
}
.doc table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 1rem;
  font-size: 0.875rem;
}
.doc th, .doc td {
  text-align: left;
  vertical-align: top;
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid var(--border);
}
.doc th {
  font-weight: 600;
  color: var(--foreground);
  white-space: nowrap;
}
.doc td { color: var(--muted-foreground); }
html.dark {
  --background: #16130f;
  --foreground: #f4efe4;
  --card: #211c16;
  --muted: #2a241c;
  --muted-foreground: #b3a896;
  --border: #ffffff1f;
  --input: #ffffff26;
  --rule: #f4efe4;
}

/* Phase A visual shell. The older merch-desk selectors above remain in place
   for the lower-page and document surfaces; this scoped layer composes the
   measured homepage without changing the payment or ranking model. */
:root {
  --background: #fffdfb;
  --foreground: #292725;
  --card: #fffdfb;
  --primary: #eb7053;
  --primary-foreground: #fffdfb;
  --muted: #f8f3f0;
  --muted-foreground: #77716d;
  --border: #e8e1dd;
  --input: #e3dcd8;
  --ring: #eb7053;
  --font: "DM Sans", "DM Sans Fallback", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --serif: var(--font);
}
html.dark {
  --background: #1b1817;
  --foreground: #f7f1ee;
  --card: #241f1d;
  --muted: #302926;
  --muted-foreground: #b9aaa4;
  --border: #ffffff22;
  --input: #ffffff2b;
  --primary: #f08a70;
  --primary-foreground: #251816;
  --ring: #f08a70;
}
body { background: var(--background); }
.site-header { min-width: 0; }
.site-header-inner,
.page {
  width: min(992px, 100%);
  max-width: 992px;
  padding-left: 0;
  padding-right: 0;
}
.site-header-inner {
  height: 76px;
  padding-top: 0;
  padding-bottom: 0;
  display: flex;
  align-items: center;
  gap: 0;
  border-bottom: 0;
  min-width: 0;
}
.brand {
  flex: 0 0 auto;
  gap: 6px;
  font-family: var(--font);
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.04em;
  line-height: 33px;
}
.rail-folio { display: none; }
.nav-wrap {
  margin-left: auto;
  gap: 0.7rem;
}
nav[aria-label="Main"] ul {
  gap: 1.2rem;
  font-size: 0.875rem;
}
nav[aria-label="Main"] a,
nav[aria-label="Main"] .nav-unavailable {
  color: var(--muted-foreground);
  font-weight: 500;
}
nav[aria-label="Main"] .nav-unavailable {
  cursor: default;
}
nav[aria-label="Main"] .nav-rules { display: none; }
.search-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: auto;
  min-width: 0;
  height: 1.9rem;
  border: 0;
  border-radius: 999px;
  padding: 0 0.35rem;
  background: transparent;
  color: var(--foreground);
  font-size: 0.75rem;
  font-weight: 650;
  line-height: 20px;
}
.search-button[disabled] { opacity: 1; cursor: default; }
.search-button:hover { background: var(--muted); }
.search-button[aria-expanded="true"] { background: var(--muted); color: var(--primary); }
.listing-search {
  position: fixed;
  top: 72px;
  right: max(16px, calc((100vw - 992px) / 2));
  z-index: 40;
  width: min(320px, calc(100vw - 32px));
}
.listing-search[hidden] { display: none; }
.listing-search-panel {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 14px;
  background: var(--card);
  box-shadow: 0 12px 28px #3d2a2420;
}
.listing-search-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.listing-search-head h2 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 20px;
}
.listing-search-close {
  border: 0;
  border-radius: 999px;
  padding: 4px 8px;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 0.6875rem;
  font-weight: 700;
}
.listing-search-close:hover,
.listing-search-close:focus-visible { background: var(--muted); color: var(--foreground); }
.listing-search-label {
  display: grid;
  gap: 5px;
  margin-top: 10px;
  color: var(--muted-foreground);
  font-size: 0.6875rem;
  font-weight: 650;
}
.listing-search-input {
  box-sizing: border-box;
  width: 100%;
  height: 40px;
  border: 1px solid var(--input);
  border-radius: 12px;
  padding: 0 10px;
  background: var(--background);
  color: var(--foreground);
  font-size: 0.8125rem;
  outline: 0;
}
.listing-search-input:focus { border-color: var(--ring); box-shadow: 0 0 0 3px color-mix(in oklab, var(--ring) 22%, transparent); }
.listing-search-status {
  min-height: 17px;
  margin: 8px 0 0;
  color: var(--muted-foreground);
  font-size: 0.6875rem;
  line-height: 17px;
}
.listing-search-results {
  display: grid;
  gap: 5px;
  max-height: 220px;
  margin: 8px 0 0;
  overflow-y: auto;
  padding: 0;
  list-style: none;
}
.listing-search-results [data-search-item][hidden] { display: none; }
.search-result {
  display: grid;
  gap: 2px;
  min-width: 0;
  width: 100%;
  border-radius: 10px;
  border: 0;
  padding: 7px 8px;
  background: var(--muted);
  text-align: left;
}
.search-result:hover,
.search-result:focus-visible { outline: 0; background: color-mix(in oklab, var(--primary) 12%, var(--muted)); }
.search-result strong,
.search-result span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.search-result strong { color: var(--foreground); font-size: 0.75rem; font-weight: 700; }
.search-result span { color: var(--muted-foreground); font-size: 0.6875rem; }
.theme-toggle {
  width: auto;
  min-width: 0;
  height: 1.9rem;
  padding: 0 0.35rem;
  font-size: 0.75rem;
  font-weight: 650;
  line-height: 20px;
}
.page {
  padding-top: 0;
  padding-bottom: 4rem;
  min-width: 0;
}
.visual-home {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
}
.visual-home #claim {
  order: 1;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
  max-width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  scroll-margin-top: 1rem;
}
.visual-home #leaderboard {
  order: 2;
  min-width: 0;
  max-width: 100%;
  margin: 0;
  padding: 0;
}
.visual-home [data-ranking-surface][hidden] { display: none !important; }
.visual-home > .last24h,
.visual-home .last24h {
  order: 3;
}
.visual-home .claim-after-cover {
  display: contents;
}
.visual-home .claim-context {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  min-width: 0;
}
.visual-home .stats-pill {
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  gap: 0.3rem;
  width: 310px;
  max-width: 100%;
  height: 32px;
  min-height: 32px;
  margin: 16px auto 0;
  padding: 6px 12px;
  border: 0;
  border-radius: 999px;
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: 0.875rem;
  line-height: 20px;
  white-space: nowrap;
}
.visual-home .ranking-tabs {
  position: absolute;
  top: -56px;
  left: 132px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  width: 173px;
  min-width: 173px;
  height: 40px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in oklab, var(--muted) 60%, transparent);
}
.visual-home .ranking-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 0;
  min-width: 0;
  gap: 0;
  height: 30px;
  border: 0;
  border-radius: 999px;
  padding: 0 0.7rem;
  background: transparent;
  color: var(--foreground);
  font-size: 0.875rem;
  line-height: 20px;
}
.visual-home .ranking-tab.is-selected { background: var(--card); box-shadow: 0 1px 2px #2927250c; }
.visual-home .ranking-tab[disabled] { opacity: 1; color: var(--primary); cursor: default; }
.visual-home .claim-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  height: 60px;
  margin: 20px 0 0;
  padding: 0;
  color: var(--foreground);
  font-family: var(--font);
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: -0.055em;
  line-height: 60px;
  white-space: nowrap;
}
.visual-home .bid-stepper { gap: 0.5rem; }
.visual-home .step {
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 999px;
  background: color-mix(in oklab, var(--primary) 15%, transparent);
  color: var(--primary);
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 22px;
}
.visual-home .step:hover,
.visual-home .step:focus-visible { background: color-mix(in oklab, var(--primary) 25%, transparent); }
.visual-home .bid-field {
  color: var(--primary);
  font-family: var(--font);
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: -0.055em;
  line-height: 60px;
}
.visual-home .bid-field:focus-within { outline: 2px solid var(--ring); outline-offset: 4px; border-radius: 6px; }
.visual-home .bid-input-wrap { align-items: center; }
.visual-home .bid-input-wrap input { color: var(--primary); }
.visual-home .claim-note { display: none; }
.visual-home .bid-form {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 256px 115px;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-top: 24px;
}
.visual-home .url-field,
.visual-home .category-select {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  height: 44px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: transparent;
  color: var(--muted-foreground);
}
.visual-home .url-field { grid-column: 1; padding: 4px 12px; }
.visual-home .url-field input {
  width: 100%;
  min-width: 0;
  border: 0;
  padding: 0;
  outline: 0;
  background: transparent;
  color: var(--foreground);
  font-size: 1rem;
  line-height: 24px;
}
.visual-home .url-field input::placeholder { color: var(--muted-foreground); opacity: 1; }
.visual-home .url-field:focus-within,
.visual-home .category-select:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
.visual-home .category-picker { position: relative; grid-column: 2; min-width: 0; }
.visual-home .category-select {
  justify-content: flex-start;
  width: 100%;
  padding: 8px 12px;
  font-size: 0.8125rem;
  line-height: 20px;
  text-align: left;
}
.visual-home .category-menu,
.visual-home .category-overflow {
  position: absolute;
  z-index: 20;
  display: grid;
  gap: 2px;
  min-width: 100%;
  max-height: 280px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--card);
  box-shadow: 0 14px 36px #3d2a241a;
}
.visual-home .category-menu { top: calc(100% + 6px); left: 0; }
.visual-home .category-overflow { top: calc(100% + 7px); right: 0; width: 180px; }
.visual-home .category-menu[hidden],
.visual-home .category-overflow[hidden] { display: none; }
.visual-home .category-choice-list {
  display: grid;
  gap: 2px;
}
.visual-home .category-menu-option,
.visual-home .category-overflow-option {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 34px;
  border: 0;
  border-radius: 8px;
  padding: 0 10px;
  background: transparent;
  color: var(--foreground);
  font-size: 0.8125rem;
  text-align: left;
}
.visual-home .category-menu-option:hover,
.visual-home .category-overflow-option:hover,
.visual-home .category-menu-option[aria-selected="true"] { background: var(--muted); }
.visual-home .claim-submit {
  grid-column: 3;
  width: 100%;
  height: 44px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 20px;
  text-transform: none;
  letter-spacing: 0;
}
.visual-home .claim-submit[disabled] { opacity: 1; background: #efb5a7; color: #fff9f6; cursor: not-allowed; }
.visual-home .claim-submit:not([disabled]):hover { background: color-mix(in oklab, var(--primary) 84%, #3a1e17); }
.visual-home .form-hint { display: none; }
.visual-home .claim-note-field { display: none; grid-column: 1 / -1; }
.visual-home .bid-form[data-note-open] .claim-note-field,
.visual-home .bid-form[data-note-open] .why-first { display: block; }
.visual-home .claim-note-field .field-label { display: block; margin: 0 0 5px; font-size: 0.75rem; color: var(--muted-foreground); }
.visual-home .claim-note-field input {
  width: 100%;
  height: 42px;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 0 12px;
  outline: 0;
  background: var(--card);
}
.visual-home .claim-note-field input:focus { border-color: var(--ring); box-shadow: 0 0 0 3px color-mix(in oklab, var(--ring) 22%, transparent); }
.visual-home .claim-note-help { margin: 4px 0 0; font-size: 0.75rem; color: var(--muted-foreground); }
.visual-home .why-first {
  display: none;
  grid-column: 1 / -1;
}
.visual-home .later-rail,
.visual-home .later-listing,
.visual-home .legacy-later-rail-copy { display: none; }
.visual-home .category-rail {
  position: relative;
  width: 100%;
  height: 32px;
  margin-top: 32px;
  padding: 0 0 4px;
  overflow: visible;
}
.visual-home .category-rail-scroll {
  display: flex;
  align-items: center;
  gap: 0;
  width: 100%;
  height: 32px;
  overflow: visible;
}
.visual-home .category-chip-list {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  gap: 9px;
  overflow: hidden;
}
.visual-home .category-chip,
.visual-home .category-more {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 5px;
  height: 32px;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 0 10px;
  background: transparent;
  color: var(--foreground);
  font-size: 0.8125rem;
  font-weight: 650;
  line-height: 20px;
  white-space: nowrap;
}
.visual-home .category-chip:hover,
.visual-home .category-chip:focus-visible { background: var(--muted); outline: 0; }
.visual-home .category-chip.is-selected { background: var(--primary); color: var(--primary-foreground); }
.visual-home .category-more {
  margin-left: 9px;
  border-color: var(--border);
  background: var(--card);
  padding: 0 12px;
  font-weight: 650;
}
.visual-home .category-more:hover,
.visual-home .category-more:focus-visible { border-color: var(--primary); outline: 0; }
.visual-home #leaderboard > .masthead { display: none; }
.visual-home #leaderboard > .row,
.visual-home #leaderboard > .later-stack {
  margin-top: 21px;
}
.visual-home #leaderboard > .row + .row,
.visual-home #leaderboard > .row + .later-stack,
.visual-home .later-stack > .row + .row { margin-top: 12px; }
.visual-home .row[data-morning-slot],
.visual-home .row[data-later-rank] {
  order: 4;
  box-sizing: border-box;
  height: 110px;
  min-height: 110px;
  max-height: 110px;
  margin-left: 0;
  margin-right: 0;
  margin-bottom: 0;
  padding: 0;
  overflow: visible;
  border: 2px solid #f1c1b5;
  border-radius: 25px;
  background: #fff7f4;
  box-shadow: none;
}
.visual-home .row[data-morning-slot] { border-color: var(--primary); background: #fce0d9; }
.visual-home .row.row-2 { border-color: #f0c6bb; background: #fff3ef; }
.visual-home .row.row-3 { border-color: #f3ded8; background: #fffbf9; }
.visual-home .row[data-morning-slot] .row-link {
  position: relative;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  grid-template-areas: "rank body bid";
  grid-template-rows: minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  box-sizing: border-box;
  width: 100%;
  height: 106px;
  min-width: 0;
  min-height: 106px;
  max-height: 106px;
  margin: 0;
  padding: 14px;
  border: 0;
  background: transparent;
  color: var(--foreground);
}
.visual-home .row[data-later-rank] .row-link {
  position: relative;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  grid-template-areas: "rank body";
  grid-template-rows: minmax(0, 1fr);
  align-items: center;
  column-gap: 10px;
  box-sizing: border-box;
  height: 106px;
  min-width: 0;
  min-height: 106px;
  max-height: 106px;
  padding: 14px;
  border: 0;
  background: transparent;
}
.visual-home .row[data-morning-slot] .row-meta,
.visual-home .row[data-later-rank] .row-meta { grid-area: rank; width: auto; padding: 0; }
.visual-home .row[data-morning-slot] .rank,
.visual-home .row[data-later-rank] .rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 29px;
  border: 0;
  border-radius: 999px;
  background: var(--primary);
  color: #fffaf8;
  font-size: 1rem;
  font-weight: 700;
  line-height: 20px;
}
.visual-home .podium-hit { min-width: 0; }
.visual-home .row[data-morning-slot] .podium-hit { display: contents; }
.visual-home .podium-body {
  grid-area: body;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  align-content: stretch;
  align-self: stretch;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}
.visual-home .row-kicker { display: none; }
.visual-home .row[data-morning-slot] .cover-why { display: none; }
.visual-home .row[data-morning-slot] .row-top { display: block; margin: 0; }
.visual-home .row[data-later-rank] .row-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: baseline;
  column-gap: 8px;
  min-width: 0;
  width: 100%;
}
.visual-home .row[data-morning-slot] .host,
.visual-home .row[data-later-rank] .dek {
  display: block;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--foreground);
  font-family: var(--font);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  line-height: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.visual-home .podium-description,
.visual-home .row[data-later-rank] .slot {
  display: -webkit-box;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--muted-foreground);
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 20px;
  min-height: 0;
  max-height: 40px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.visual-home .podium-meta,
.visual-home .row[data-later-rank] .row-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 6px;
  min-width: 0;
  margin: 2px 0 0;
  overflow: hidden;
  color: var(--muted-foreground);
  font-size: 0.6875rem;
  line-height: 16px;
  white-space: nowrap;
  align-self: end;
}
.visual-home .podium-category,
.visual-home .podium-clicks { color: var(--foreground); font-weight: 650; }
.visual-home .podium-meta .when { color: var(--muted-foreground); }
.visual-home .podium-host,
.visual-home .podium-details { overflow: hidden; text-overflow: ellipsis; }
.visual-home .cover-later { display: contents; }
.visual-home .cover-later .bid,
.visual-home .row[data-later-rank] .bid {
  margin: 0;
  color: var(--primary);
  font-size: 1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-decoration: none;
}
.visual-home .cover-later .bid {
  grid-area: bid;
  align-self: start;
  justify-self: end;
}
.visual-home .row[data-later-rank] .bid {
  align-self: baseline;
  justify-self: end;
  min-width: max-content;
}
.visual-home .cover-later .clicks { display: none; }
.visual-home .row[data-later-rank] .claim-after-row { display: none; }
.visual-home .cover-hop-wrap,
.visual-home .list-route-wrap { position: absolute; z-index: 2; margin: 0; }
.visual-home .cover-hop-wrap { right: 14px; bottom: 10px; }
.visual-home .cover-hop {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  border-radius: 999px;
  border: 0;
  padding: 0 9px;
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 0.6875rem;
  font-weight: 700;
  opacity: 0;
  transition: opacity 120ms ease;
}
.visual-home .row[data-morning-slot]:hover .cover-hop,
.visual-home .row[data-morning-slot]:focus-within .cover-hop { opacity: 1; }
.visual-home .list-route-wrap { left: 14px; bottom: 10px; display: none; }
.visual-home .list-route { color: var(--muted-foreground); font-size: 0.6875rem; }
.visual-home .today-preview {
  margin-top: 23px;
  padding: 0;
}
.visual-home .preview-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 20px;
  margin: 0;
}
.visual-home .preview-heading h2 {
  margin: 0;
  color: var(--foreground);
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 20px;
}
.visual-home .preview-see-all { color: var(--muted-foreground); font-size: 0.75rem; }
.visual-home .preview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 8px;
}
.visual-home .preview-card {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 6px;
  min-width: 0;
  height: 64px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 8px 10px;
  background: var(--card);
  box-shadow: 0 9px 22px #3d2a2410;
}
.visual-home .preview-card:hover,
.visual-home .preview-card:focus-visible { border-color: var(--primary); outline: 0; }
.visual-home .preview-rank { color: var(--muted-foreground); font-size: 0.6875rem; font-weight: 650; }
.visual-home .preview-copy { display: flex; min-width: 0; flex-direction: column; overflow: hidden; line-height: 16px; }
.visual-home .preview-copy strong,
.visual-home .preview-copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.visual-home .preview-copy strong { color: var(--foreground); font-size: 0.6875rem; font-weight: 700; }
.visual-home .preview-copy span { color: var(--muted-foreground); font-size: 0.6875rem; }
.visual-home .preview-bid { align-self: end; color: var(--primary); font-size: 0.6875rem; font-weight: 700; white-space: nowrap; }
.visual-home .last24h {
  width: 100%;
  margin-top: 23px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.visual-home .last24h-kicker { color: var(--foreground); font-size: 0.8rem; letter-spacing: 0; text-transform: none; }
.visual-home .last24h-dek { max-width: 48rem; font-size: 0.75rem; }
.visual-home .last24h-empty { border: 0; padding: 0; font-size: 0.75rem; }
.visual-home .last24h-list { margin-top: 10px; }
.visual-home .last24h-link { padding: 9px 0; }
.visual-home .last24h-host { font-family: var(--font); font-size: 0.8rem; font-weight: 650; }
.visual-home .last24h-why { font-size: 0.75rem; }
.visual-home .last24h-meta { font-size: 0.6875rem; }
.visual-home .empty {
  box-sizing: border-box;
  display: flex;
  min-height: 106px;
  height: 106px;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  margin-top: 20px;
  overflow: hidden;
  border-color: var(--border);
  border-radius: 20px;
  padding: 14px 18px;
  background: var(--muted);
}
.visual-home .empty p { margin: 0; }
.visual-home .empty-details {
  margin: 10px 2px 0;
  color: var(--muted-foreground);
  font-size: 0.75rem;
  line-height: 18px;
}
.visual-home .empty-kicker { color: var(--primary); }

.desk:has(.empty) .visual-home #claim .claim-title {
  font-size: 2.5rem;
  line-height: 60px;
}

/* The legacy occupied-state rules remain above for contract coverage. Keep
   the visual home shell's first read in the same position for a paid board. */
.desk[data-occupied="true"] .visual-home .claim-after-cover[data-claim-after-cover] {
  display: contents;
  margin: 0;
}
.desk[data-occupied="true"] .visual-home .claim-after-cover[data-claim-after-cover] #claim {
  margin: 0;
  padding: 0;
  border: 0;
}
.desk[data-occupied="true"] .visual-home .claim-after-cover[data-claim-after-cover] #claim .claim-title {
  height: 60px;
  margin: 20px 0 0;
  padding: 0;
  font-family: var(--font);
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: -0.055em;
  line-height: 60px;
}
.desk[data-occupied="true"] .visual-home .claim-after-cover[data-claim-after-cover] #claim .claim-note {
  display: none;
}
.desk .visual-home #claim .claim-submit {
  width: 115px;
  height: 44px;
  min-width: 115px;
  max-width: 115px;
  margin: 0;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 0 10px;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
  white-space: nowrap;
  overflow: hidden;
}
.desk[data-occupied="true"] .visual-home .claim-after-cover[data-claim-after-cover] #claim .claim-submit {
  height: 44px;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0;
}
.desk[data-occupied="true"] .visual-home #claim .later-rail[data-later-rail],
.desk[data-occupied="true"] .visual-home #claim .later-listing[data-later-listing] {
  display: none;
}
.desk[data-occupied="true"] .visual-home .row[data-morning-slot] .host[data-cover-name] {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  line-height: 24px;
}
.desk[data-occupied="true"] .visual-home .list-route-wrap[data-list-route-wrap] { display: none; }
.visual-home .later-stack {
  display: contents;
  margin: 0;
  padding: 0;
  border: 0;
}
.visual-home .later-stack-kicker,
.visual-home .later-stack-dek { display: none; }
.visual-home .later-stack > .row[data-later-rank] {
  box-sizing: border-box;
  height: 110px;
  min-height: 110px;
  max-height: 110px;
  margin-left: 0;
  margin-right: 0;
  padding: 0;
  overflow: visible;
  border: 2px solid #f1c1b5;
  border-radius: 25px;
  background: #fff7f4;
  box-shadow: none;
}
.visual-home .later-stack > .row[data-later-rank] .row-link {
  min-height: 106px;
  border: 0;
  background: transparent;
}
.visual-home .last24h + .later-stack > .row[data-later-rank] { margin-top: 12px; }
.visual-home .row[data-later-rank] {
  box-sizing: border-box;
  height: 110px;
  min-height: 110px;
  max-height: 110px;
  margin-left: 0;
  margin-right: 0;
  padding: 0;
  overflow: visible;
  border: 2px solid #f1c1b5;
  border-radius: 25px;
  background: #fff7f4;
  box-shadow: none;
}
.visual-home .row[data-later-rank].row-2 { border-color: #f0c6bb; background: #fff3ef; }
.visual-home .row[data-later-rank].row-3 { border-color: #f3ded8; background: #fffbf9; }

@media (max-width: 767px) {
  .site-header-inner,
  .page { width: 100%; max-width: none; padding-left: 16px; padding-right: 16px; }
  .site-header-inner { height: 68px; }
  .brand { font-size: 22px; font-weight: 500; line-height: 33px; }
  .nav-wrap { min-width: 0; gap: 0.2rem; }
  nav[aria-label="Main"] ul { gap: 0.62rem; font-size: 0.75rem; }
  nav[aria-label="Main"] li:first-child,
  nav[aria-label="Main"] .nav-rules { display: none; }
  .search-button,
  .theme-toggle { width: auto; min-width: 0; height: 1.7rem; padding: 0 0.2rem; font-size: 0.6875rem; }
  .listing-search { top: 60px; right: 16px; width: calc(100vw - 32px); }
  .visual-home .ranking-tabs {
    position: static;
    align-self: center;
    height: 40px;
    margin-top: 22px;
  }
  .visual-home .stats-pill { width: 306px; margin-top: 17px; font-size: 0.8125rem; }
  .visual-home .claim-title {
    height: 44px;
    margin-top: 21px;
    font-size: 1.75rem;
    line-height: 44px;
    letter-spacing: -0.055em;
  }
  .desk:has(.empty) .visual-home #claim .claim-title {
    font-size: 1.75rem;
    line-height: 44px;
  }
  .desk[data-occupied="true"] .visual-home .claim-after-cover[data-claim-after-cover] #claim .claim-title {
    height: 44px;
    margin-top: 21px;
    font-size: 1.75rem;
    line-height: 44px;
  }
  .visual-home .bid-field { font-size: 1.75rem; line-height: 44px; }
  .visual-home .step { width: 22px; height: 22px; }
  .visual-home .bid-form {
    grid-template-columns: 1fr;
    gap: 8px;
    margin-top: 21px;
  }
  .visual-home .url-field,
  .visual-home .category-picker,
  .visual-home .claim-submit { grid-column: 1; }
  .visual-home .claim-submit { height: 44px; }
  .desk .visual-home #claim .claim-submit,
  .desk[data-occupied="true"] .visual-home .claim-after-cover[data-claim-after-cover] #claim .claim-submit {
    width: 100%;
    min-width: 0;
    max-width: none;
    height: 44px;
    padding: 0 16px;
    white-space: nowrap;
  }
  .visual-home .category-rail { margin-top: 32px; }
  .visual-home .category-rail-scroll {
    min-width: 0;
    flex-wrap: nowrap;
    gap: 0;
  }
  .visual-home .category-chip-list {
    flex-wrap: nowrap;
    gap: 7px;
    overflow: hidden;
  }
  .visual-home .category-chip { padding: 0 9px; }
  .visual-home .category-chip:nth-child(n + 5) { display: none; }
  .visual-home .category-more { margin-left: 7px; padding: 0 10px; }
  .visual-home .last24h + .later-stack > .row[data-later-rank] { margin-top: 6px; }
  .visual-home #leaderboard > .row { margin-top: 20px; }
  .visual-home #leaderboard > .later-stack { margin-top: 20px; }
  .visual-home #leaderboard > .row + .row,
  .visual-home #leaderboard > .row + .later-stack,
  .visual-home .later-stack > .row + .row { margin-top: 6px; }
  .visual-home .row[data-morning-slot],
  .visual-home .row[data-later-rank] {
    height: 123px;
    min-height: 123px;
    max-height: 123px;
    border-radius: 20px;
  }
  .visual-home .row[data-morning-slot] .row-link,
  .visual-home .row[data-later-rank] .row-link {
    grid-template-columns: 40px minmax(0, 1fr) auto;
    grid-template-areas: "rank body bid";
    grid-template-rows: minmax(0, 1fr);
    column-gap: 8px;
    box-sizing: border-box;
    height: 119px;
    min-width: 0;
    min-height: 119px;
    max-height: 119px;
    padding: 10px;
  }
  .visual-home .row[data-later-rank] .row-link {
    grid-template-columns: 40px minmax(0, 1fr);
    grid-template-areas: "rank body";
    min-height: 119px;
    padding: 10px;
  }
  .visual-home .row[data-morning-slot] .rank,
  .visual-home .row[data-later-rank] .rank { min-width: 30px; height: 27px; font-size: 0.8125rem; }
  .visual-home .row[data-morning-slot] .row-meta,
  .visual-home .row[data-later-rank] .row-meta {
    align-self: stretch;
    justify-content: flex-start;
    min-height: 0;
    padding-top: 17px;
  }
  .visual-home .podium-body {
    grid-template-rows: 23px minmax(0, 1fr) auto;
    height: 92px;
    min-height: 92px;
    max-height: 92px;
    align-self: start;
    padding-top: 1px;
  }
  .visual-home .row[data-morning-slot] .host,
  .visual-home .row[data-later-rank] .dek { font-size: 0.875rem; line-height: 20px; }
  .desk[data-occupied="true"] .visual-home .row[data-morning-slot] .host[data-cover-name] { font-size: 0.875rem; line-height: 20px; }
  .visual-home .podium-description,
  .visual-home .row[data-later-rank] .slot {
    max-height: 34px;
    font-size: 0.75rem;
    line-height: 17px;
    -webkit-line-clamp: 2;
  }
  .visual-home .podium-meta,
  .visual-home .row[data-later-rank] .row-foot {
    flex-wrap: wrap;
    font-size: 0.625rem;
    line-height: 15px;
    white-space: normal;
  }
  .visual-home .cover-later .bid,
  .visual-home .row[data-later-rank] .bid { font-size: 0.875rem; }
  .visual-home .cover-hop-wrap { right: 10px; bottom: 7px; }
  .visual-home .today-preview { margin-top: 18px; }
  .visual-home .preview-grid { grid-template-columns: 1fr; }
  .visual-home .preview-card { width: 100%; }
  .visual-home .last24h { margin-top: 20px; }
}

/* R20 exact-reference layer. Geometry remains the measured 992/358px shell;
   this final layer supplies the same open font, colors, icons, and card anatomy
   as the frozen Outbid frame. Reference-only copy/data is gated in the view by
   the local fixture checkout port and never appears in Waffo modes. */
:root {
  --background: #fffdfb;
  --foreground: #292522;
  --primary: #d6785d;
  --primary-foreground: #fffdfa;
  --muted: #f6f3f0;
  --muted-foreground: #746c67;
  --border: #e9e2de;
  --input: #e9e2de;
  --ring: #d6785d;
  --font: "Outbid DM Sans", Arial, sans-serif;
  --serif: var(--font);
}

html,
body,
button,
input { font-family: var(--font); }
body { line-height: normal; }

.brand {
  gap: 6px;
  color: var(--foreground);
  font-size: 22px;
  font-weight: 500;
  line-height: 33px;
  letter-spacing: -0.04em;
}
.brand-mark {
  width: 25.7142857px;
  height: 20px;
  display: block;
  flex: 0 0 auto;
}
.brand-dot { color: #d97562; }
.nav-wrap { gap: 16px; }
nav[aria-label="Main"] ul { gap: 20px; }
.search-button,
.theme-toggle {
  width: 28px;
  min-width: 28px;
  height: 28px;
  padding: 0;
  flex: 0 0 28px;
}
.search-button > img,
.theme-toggle > img {
  width: 16px;
  height: 16px;
  display: block;
}

.visual-home .stats-pill {
  width: 306px;
  background: #f6f3f0;
  color: #746c67;
  gap: 3px;
}
.visual-home .stats-pill-reference {
  display: block;
  justify-content: flex-start;
  white-space: nowrap;
}
.stats-pill-reference .stats-live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #449d40;
  font-weight: 600;
}
.stats-pill-reference .stats-live > span {
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  border-radius: 999px;
  background: #449d40;
}
.stats-pill-reference .stats-window {
  display: inline;
  color: #746c67;
}
.stats-pill-reference .stats-link {
  display: inline;
  color: var(--foreground);
  font-weight: 400;
  text-decoration: none;
}

.visual-home .ranking-tab { gap: 6px; letter-spacing: -0.025em; }
.visual-home .ranking-tabs { left: 131.6796875px; width: 172.875px; min-width: 172.875px; }
.visual-home .ranking-tab {
  min-height: 30px;
  height: 30px;
  flex: 0 0 auto;
  padding: 8px 10px;
  font-weight: 500;
  line-height: 14px;
  white-space: nowrap;
}
.visual-home .ranking-tab > img { width: 14px; height: 14px; display: block; }
.visual-home .ranking-tab[aria-selected="false"] { color: #d6785d; }
.visual-home .ranking-live-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  border-radius: 999px;
  background: #d6785d;
  box-shadow: 0 0 0 4px rgb(214 120 93 / 10%);
}
.visual-home .step { color: #d6785d; background: #f9e9e4; }
.visual-home .claim-title,
.visual-home .bid-field,
.desk[data-occupied="true"] .visual-home .claim-after-cover[data-claim-after-cover] #claim .claim-title {
  letter-spacing: -0.03em;
}
.visual-home .bid-field,
.visual-home .bid-input-wrap input { color: #d6785d; }
.visual-home .url-field {
  padding-left: 40px;
  background-image: url("/icons/globe.svg");
  background-repeat: no-repeat;
  background-position: 12px 50%;
  background-size: 14px 14px;
}
.visual-home .claim-submit[disabled] { background: #eabaac; }
.visual-home .category-chip > img,
.visual-home .category-more > img {
  width: 16px;
  height: 16px;
  display: block;
  flex: 0 0 16px;
  opacity: 0.62;
}
.visual-home .category-menu-option > img,
.visual-home .category-overflow-option > img { width: 16px; height: 16px; display: block; }
.visual-home .category-chip.is-selected { background: #d6785d; }
.visual-home .category-more > img { width: 14px; height: 14px; flex-basis: 14px; opacity: 1; }
.visual-home .category-rail {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 0;
}
.visual-home .category-rail-scroll {
  width: calc(100% - 91.21875px);
  min-width: 0;
  height: 32px;
  flex: 0 0 calc(100% - 91.21875px);
  align-items: flex-start;
  padding: 0 0 4px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}
.visual-home .category-rail-scroll::-webkit-scrollbar { display: none; }
.visual-home .category-chip-list {
  flex: 0 0 auto;
  gap: 8px;
  overflow: visible;
}
.visual-home .category-chip,
.visual-home .category-more {
  height: 28px;
  min-height: 28px;
  gap: 4px;
  padding: 0 10px;
  font-size: 12.8px;
  font-weight: 700;
  line-height: 18.2857px;
}
.visual-home .category-chip { padding: 0 10px; }
.visual-home .category-more {
  width: 83.21875px;
  min-width: 83.21875px;
  flex: 0 0 83.21875px;
  justify-content: center;
  margin: 2px 0 0;
  padding: 0 6px 0 10px;
  line-height: 19.2px;
}
.visual-home .category-select {
  padding-right: 36px;
  background-image: url("/icons/chevron-down.svg");
  background-repeat: no-repeat;
  background-position: calc(100% - 12px) 50%;
  background-size: 16px 16px;
}

.desk[data-reference-fixture] .visual-home .row[data-morning-slot] {
  border-color: #d47155;
  background: #f6dfd8;
}
.desk[data-reference-fixture] .visual-home .row.row-2 {
  border-color: #ecbeaf;
  background: #fcf3ee;
}
.desk[data-reference-fixture] .visual-home .row.row-3 {
  border-color: #f9ece7;
  background: #fdf9f6;
}
.desk[data-reference-fixture] .visual-home #leaderboard > .row.row-1 { margin-top: 20px; }
.desk[data-reference-fixture] .visual-home .row[data-reference-card] {
  padding: 0 14px;
  border-radius: 25.2px;
}
.desk[data-reference-fixture] .visual-home .row[data-morning-slot] .row-link,
.desk[data-reference-fixture] .visual-home .row[data-later-rank] .row-link {
  grid-template-columns: 108px minmax(0, 1fr);
  grid-template-areas: "leading body";
  column-gap: 12px;
  width: 100%;
  height: 106px;
  min-height: 106px;
  max-height: 106px;
  margin: 0;
  padding: 12px 0;
}
.desk[data-reference-fixture] .visual-home .row-leading {
  grid-area: leading;
  width: 108px;
  display: flex;
  flex: 0 0 108px;
  align-items: center;
  gap: 12px;
}
.desk[data-reference-fixture] .visual-home .row-leading .row-meta { width: 40px; }
.desk[data-reference-fixture] .visual-home .row-leading .rank {
  min-width: 40px;
  height: 28px;
  padding: 2px 8px;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}
.desk[data-reference-fixture] .visual-home .card-avatar {
  width: 56px;
  height: 56px;
  display: flex;
  flex: 0 0 56px;
  overflow: hidden;
  border-radius: 11.2px;
  background: #fff;
}
.desk[data-reference-fixture] .visual-home .card-avatar img {
  width: 24px;
  height: 24px;
  display: block;
  margin: auto;
}
.desk[data-reference-fixture] .visual-home .podium-body {
  height: 82px;
  min-height: 82px;
  max-height: 82px;
  grid-template-rows: 24px 40px 18px;
}
.desk[data-reference-fixture] .visual-home .row[data-morning-slot] .host,
.desk[data-reference-fixture] .visual-home .row[data-later-rank] .dek,
.desk[data-reference-fixture] .visual-home .row[data-morning-slot] .host[data-cover-name] {
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
  letter-spacing: 0;
}
.desk[data-reference-fixture] .visual-home .podium-description,
.desk[data-reference-fixture] .visual-home .row[data-later-rank] .slot {
  height: 40px;
  max-height: 40px;
  color: rgb(116 108 103 / 70%);
  font-size: 14px;
  line-height: 20px;
}
.desk[data-reference-fixture] .visual-home .podium-meta,
.desk[data-reference-fixture] .visual-home .row[data-later-rank] .row-foot {
  height: 16px;
  margin-top: 2px;
  color: #746c67;
  font-size: 12px;
  line-height: 16px;
  gap: 0 6px;
}
.desk[data-reference-fixture] .visual-home .podium-category {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #292522;
  font-weight: 600;
}
.desk[data-reference-fixture] .visual-home .podium-category > img {
  width: 12px;
  height: 12px;
  display: block;
}
.desk[data-reference-fixture] .visual-home .podium-clicks,
.desk[data-reference-fixture] .visual-home .row-foot .clicks { color: #292522; font-weight: 400; }
.desk[data-reference-fixture] .visual-home .cover-later .bid,
.desk[data-reference-fixture] .visual-home .row[data-later-rank] .bid {
  color: #d6785d;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}
.desk[data-reference-fixture] .visual-home .cover-later .bid { display: none; }
.desk[data-reference-fixture] .visual-home .reference-card-price {
  display: block;
  margin: 0;
  color: #d6785d;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  white-space: nowrap;
}
.desk[data-reference-fixture] .visual-home .row[data-morning-slot] .row-top {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 8px;
}
.desk[data-reference-fixture] .visual-home .row[data-morning-slot] .row-top .host {
  min-width: 0;
  flex: 1 1 0;
}
.desk[data-reference-fixture] .visual-home .row[data-morning-slot] .row-top .reference-card-price {
  flex: 0 0 auto;
}

.visual-home .outbid-today-reference { width: 100%; min-width: 0; margin-top: 20px; }
.outbid-today-reference .preview-heading { margin-bottom: 10px; }
.outbid-today-reference .preview-heading h2 { font-size: 14px; font-weight: 600; letter-spacing: -0.02em; }
.outbid-today-list,
.outbid-activity-list { min-width: 0; margin: 0; padding: 0; list-style: none; }
.outbid-today-list { height: 63px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.outbid-today-list > li,
.outbid-today-list > li > a { min-width: 0; height: 63px; }
.outbid-today-list > li > a {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid rgb(214 120 93 / 30%);
  border-radius: 19.6px;
  background: #fff;
  box-shadow: 0 6px 22px rgb(40 38 36 / 8%);
  font-size: 12px;
  line-height: 16px;
}
.outbid-today-rank { flex: 0 0 auto; color: #746c67; font-size: 11px; font-weight: 600; line-height: 14.6667px; }
.outbid-today-icon { width: 28px; height: 28px; display: flex; flex: 0 0 28px; overflow: hidden; border-radius: 11.2px; }
.outbid-today-icon img { width: 100%; height: 100%; display: block; object-fit: contain; }
.outbid-today-copy { min-width: 0; height: 45px; display: block; flex: 1 1 0; line-height: 15px; }
.outbid-today-copy > strong,
.outbid-today-copy > span,
.outbid-today-copy > b { min-width: 0; display: block; height: 15px; margin: 0; overflow: hidden; font-size: 12px; line-height: 15px; text-overflow: ellipsis; white-space: nowrap; }
.outbid-today-copy > strong { color: #292522; font-weight: 600; }
.outbid-today-copy > span { color: rgb(116 108 103 / 70%); font-weight: 400; }
.outbid-today-copy > b { color: #d6785d; font-weight: 600; }

.outbid-activity-reference { order: 3; width: 100%; margin: 20px 0; }
.outbid-activity-reference h2 { min-height: 21.5px; display: flex; align-items: center; gap: 6px; margin: 0 0 10px; font-size: 14px; font-weight: 600; line-height: 20px; letter-spacing: -0.02em; }
.outbid-activity-reference h2 > span { width: 8px; height: 8px; flex: 0 0 8px; border-radius: 999px; background: #d6785d; box-shadow: 0 0 0 4px rgb(214 120 93 / 12%); }
.outbid-activity-list { height: 52px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.outbid-activity-list > li,
.outbid-activity-list > li > a { min-width: 0; height: 52px; }
.outbid-activity-list > li > a { display: grid; grid-template-columns: 20px minmax(0, 1fr); align-items: start; gap: 0 8px; padding: 8px 10px; border-radius: 11.2px; background: #f6f3f0; font-size: 12px; line-height: 16px; }
.outbid-activity-icon { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 11.2px; background: #fff; }
.outbid-activity-icon img { width: 16px; height: 16px; display: block; object-fit: contain; }
.outbid-activity-icon-blue { background: #496fd5; }
.outbid-activity-copy { min-width: 0; height: 36px; display: block; line-height: 12px; }
.outbid-activity-copy > strong,
.outbid-activity-copy > span,
.outbid-activity-copy > small { min-width: 0; display: block; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.outbid-activity-copy > strong { height: 12px; color: #292522; font-size: 12px; font-weight: 600; line-height: 12px; }
.outbid-activity-copy > span { height: 12px; margin-top: 1px; color: #746c67; font-size: 12px; line-height: 12px; }
.outbid-activity-copy > small { height: 10px; margin-top: 1px; color: #746c67; font-size: 10px; line-height: 10px; }

.outbid-reference-fourth { position: relative; order: 3; width: 100%; height: 86px; padding: 0 16px; }
.outbid-reference-fourth-link { position: absolute; inset: 0; z-index: 0; display: block; }
.outbid-reference-fourth-body { position: relative; z-index: 1; width: 100%; height: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 0; pointer-events: none; }
.outbid-reference-fourth-rank { min-width: 40px; flex: 0 0 40px; color: #746c67; font-size: 16px; font-weight: 500; line-height: 24px; text-align: center; }
.outbid-reference-fourth-icon { width: 56px; height: 56px; display: flex; flex: 0 0 56px; align-items: center; justify-content: center; border-radius: 11.2px; background: #fff; }
.outbid-reference-fourth-icon img { width: 32px; height: 32px; display: block; }
.outbid-reference-fourth-copy { min-width: 0; flex: 1 1 0; }
.outbid-reference-fourth-copy > div { min-width: 0; display: flex; align-items: baseline; gap: 8px; }
.outbid-reference-fourth-copy h3,
.outbid-reference-fourth-copy strong,
.outbid-reference-fourth-copy p,
.outbid-reference-fourth-copy footer { margin: 0; }
.outbid-reference-fourth-copy h3 { min-width: 0; flex: 1 1 0; overflow: hidden; font-size: 16px; font-weight: 500; line-height: 24px; text-overflow: ellipsis; white-space: nowrap; }
.outbid-reference-fourth-copy strong { color: #d6785d; font-size: 16px; font-weight: 600; line-height: 24px; }
.outbid-reference-fourth-copy p { height: 20px; overflow: hidden; color: rgb(116 108 103 / 70%); font-size: 14px; line-height: 20px; text-overflow: ellipsis; white-space: nowrap; }
.outbid-reference-fourth-copy footer { height: 16px; display: flex; align-items: center; gap: 0 6px; margin-top: 2px; overflow: hidden; color: #746c67; font-size: 12px; line-height: 16px; white-space: nowrap; }
.outbid-reference-fourth-category { display: inline-flex; align-items: center; gap: 4px; color: #292522; font-weight: 600; }
.outbid-reference-fourth-category img { width: 12px; height: 12px; display: block; }

@media (max-width: 767px) {
  .site-header-inner { height: 69px; padding-top: 20px; padding-bottom: 16px; align-items: flex-start; }
  .nav-wrap { height: 33px; gap: 8px; }
  nav[aria-label="Main"] ul { gap: 8px; font-weight: 500; line-height: 16px; }
  .search-button,
  .theme-toggle { width: 28px; min-width: 28px; height: 28px; padding: 0; }
  .visual-home .stats-pill { height: 32.5px; min-height: 32.5px; margin-top: 16px; font-size: 14px; }
  .visual-home .ranking-tabs { margin-top: 19.984375px; }
  .visual-home .claim-title,
  .desk:has(.empty) .visual-home #claim .claim-title,
  .desk[data-occupied="true"] .visual-home .claim-after-cover[data-claim-after-cover] #claim .claim-title {
    height: 42px;
    min-height: 42px;
    margin-top: 20px;
    font-size: 28px;
    line-height: 42px;
  }
  .visual-home .step {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    font-size: 14px;
    line-height: 20px;
  }
  .visual-home .bid-field {
    display: flex;
    align-items: center;
    font-size: 28px;
    line-height: 42px;
  }
  .visual-home .bid-field input { letter-spacing: normal; }
  .visual-home .bid-form { margin-top: 24px; }
  .visual-home .category-rail {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 0;
  }
  .visual-home .category-rail-scroll {
    width: calc(100% - 91.21875px);
    min-width: 0;
    height: 32px;
    flex: 0 0 calc(100% - 91.21875px);
    padding: 0 0 4px;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }
  .visual-home .category-rail-scroll::-webkit-scrollbar { display: none; }
  .visual-home .category-chip-list { flex: 0 0 auto; gap: 8px; overflow: visible; }
  .visual-home .category-chip { padding: 0 10px; }
  .visual-home .category-more {
    width: 83.21875px;
    min-width: 83.21875px;
    flex: 0 0 83.21875px;
    justify-content: center;
    margin: 2px 0 0;
    padding: 0 6px 0 10px;
    line-height: 19.2px;
  }
  .desk[data-reference-fixture] .visual-home .row[data-reference-card] {
    padding: 0 10px;
    border-radius: 19.6px;
  }
  .desk[data-reference-fixture] .visual-home .row[data-morning-slot] .row-link,
  .desk[data-reference-fixture] .visual-home .row[data-later-rank] .row-link {
    grid-template-columns: 40px minmax(0, 1fr);
    grid-template-areas: "leading body";
    column-gap: 8px;
    width: 100%;
    height: 119px;
    min-height: 119px;
    max-height: 119px;
    margin: 0;
    padding: 8px 0;
  }
  .desk[data-reference-fixture] .visual-home .row-leading {
    width: 40px;
    flex: 0 0 40px;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
  }
  .desk[data-reference-fixture] .visual-home .row-leading .row-meta { width: 40px; align-self: auto; min-height: 0; padding: 0; }
  .desk[data-reference-fixture] .visual-home .row-leading .rank {
    min-width: 28px;
    width: auto;
    height: 18px;
    min-height: 18px;
    padding: 1px 6px;
    font-size: 12px;
    line-height: 16px;
  }
  .desk[data-reference-fixture] .visual-home .card-avatar { width: 40px; height: 40px; flex-basis: 40px; }
  .desk[data-reference-fixture] .visual-home .card-avatar img { width: 20px; height: 20px; }
  .desk[data-reference-fixture] .visual-home .podium-body {
    height: 103px;
    min-height: 103px;
    max-height: 103px;
    grid-template-rows: 20px 48px 35px;
    padding-top: 0;
  }
  .desk[data-reference-fixture] .visual-home .row[data-morning-slot] .host,
  .desk[data-reference-fixture] .visual-home .row[data-later-rank] .dek,
  .desk[data-reference-fixture] .visual-home .row[data-morning-slot] .host[data-cover-name] {
    font-size: 14px;
    line-height: 20px;
  }
  .desk[data-reference-fixture] .visual-home .podium-description,
  .desk[data-reference-fixture] .visual-home .row[data-later-rank] .slot {
    height: 48px;
    max-height: 48px;
    font-size: 12px;
    line-height: 16px;
    -webkit-line-clamp: 3;
  }
  .desk[data-reference-fixture] .visual-home .podium-meta,
  .desk[data-reference-fixture] .visual-home .row[data-later-rank] .row-foot {
    min-height: 33px;
    height: 33px;
    align-content: flex-start;
    flex-wrap: wrap;
    font-size: 11px;
    line-height: 16.5px;
  }
  .desk[data-reference-fixture] .visual-home .cover-later .bid,
  .desk[data-reference-fixture] .visual-home .row[data-later-rank] .bid { font-size: 14px; line-height: 20px; }
  .desk[data-reference-fixture] .visual-home .reference-card-price { font-size: 14px; line-height: 20px; }
  .outbid-today-list,
  .outbid-activity-list { height: auto; display: flex; flex-direction: column; }
  .outbid-today-list > li > a { border-color: transparent; border-radius: 0; background: transparent; box-shadow: none; }
  .outbid-reference-fourth { padding: 0 10px; }
}

@media (min-width: 768px) {
  .brand,
  .nav-wrap { margin-top: 4px; }
  .visual-home .stats-pill { width: 302.09375px; height: 32.5px; min-height: 32.5px; }
}

/* The root layout keeps the ordinary Brief Desk header for non-fixture pages. */
body > .site-header:not([data-site-header]) { display: none !important; }
body:has(.outbid-reference-root) > .sheet > .site-header { display: none !important; }
.outbid-reference-root { display: contents; }
@media (max-width: 767px) {
  .outbid-reference-root > .site-header { height: 69px; }
}
.outbid-reference-root .visual-home .rank,
.outbid-reference-root .visual-home .bid,
.outbid-reference-root .visual-home .clicks {
  font-family: "Outbid DM Sans", Arial, sans-serif !important;
}
.outbid-reference-root .visual-home .ranking-tabs { z-index: 11; }
.outbid-reference-root .visual-home .rank {
  grid-area: auto;
  letter-spacing: normal;
  text-transform: none;
}
.outbid-reference-root .visual-home .bid { grid-area: auto; }
.outbid-reference-root .visual-home .clicks {
  font-size: inherit !important;
  line-height: inherit !important;
}
.visual-home .project-brief-fields {
  display: grid;
  gap: 6px;
  min-width: 240px;
  margin: 0 0 4px;
  padding: 4px 4px 9px;
  border: 0;
  border-bottom: 1px solid var(--border);
}
.visual-home .project-brief-fields legend {
  padding: 0 5px;
  color: var(--muted-foreground);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.visual-home .project-brief-fields label {
  display: grid;
  gap: 3px;
  color: var(--muted-foreground);
  font-size: 0.6875rem;
  font-weight: 650;
}
.visual-home .project-brief-fields input {
  width: 100%;
  min-width: 0;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 5px 8px;
  outline: 0;
  background: var(--background);
  color: var(--foreground);
  font-size: 0.8125rem;
  font-weight: 500;
}
.visual-home .project-brief-fields input:focus-visible {
  border-color: var(--ring);
  outline: 2px solid color-mix(in oklab, var(--ring) 34%, transparent);
}

@media (prefers-reduced-motion: reduce) {
  .visual-home .cover-hop { transition: none; }
}
`;
