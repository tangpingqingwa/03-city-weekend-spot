import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./board.css";

export const metadata: Metadata = {
  title: "City Weekend Spot",
  description:
    "This weekend in this city, #1 is whoever paid the most. Rank is money, not stars.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <a className="logo" href="/">
              city<span>.</span>weekend
            </a>
            <nav className="site-nav" aria-label="Main">
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
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
