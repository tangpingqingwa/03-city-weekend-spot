import Script from "next/script";
import React from "react";
import {
  renderBoardPage,
  type BoardViewModel,
} from "../views/outbid-reference-board";

type RenderedDocument = {
  css: string;
  markup: string;
  scripts: string[];
};

function splitRenderedDocument(documentHtml: string): RenderedDocument {
  const style = /<style>([\s\S]*?)<\/style>/.exec(documentHtml)?.[1];
  const body = /<body>([\s\S]*?)<\/body>/.exec(documentHtml)?.[1];
  if (!style || !body) {
    throw new Error("reference_document_invalid");
  }
  const scripts = Array.from(
    body.matchAll(/<script>([\s\S]*?)<\/script>/g),
    (match) => match[1] ?? "",
  );
  return {
    css: style,
    markup: body.replaceAll(/<script>[\s\S]*?<\/script>/g, ""),
    scripts,
  };
}

export function adaptReferenceDocument(documentHtml: string): string {
  return documentHtml
    .replace('action="/checkout"', 'action="/nyc/checkout"')
    .replace('name="productUrl"', 'name="bookingUrl"')
    .replace('name="whyTestThisToday"', 'name="pitch"')
    .replaceAll(/href="\/r\/([^"#?]+)"/g, 'href="/nyc/click/$1"')
    .replaceAll(/data-target="\/r\/([^"#?]+)"/g, 'data-target="/nyc/click/$1"');
}

export function OutbidReferenceFixturePage({
  model,
}: {
  model: BoardViewModel;
}) {
  const rendered = splitRenderedDocument(
    adaptReferenceDocument(renderBoardPage(model)),
  );
  const boot = `document.title = "City Weekend Spot"; document.documentElement.classList.remove("dark"); try { localStorage.setItem("theme", "light"); } catch (error) {}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: rendered.css }} />
      <div
        className="outbid-reference-root"
        data-reference-fixture-root=""
        dangerouslySetInnerHTML={{ __html: rendered.markup }}
      />
      {rendered.scripts.map((source, index) => (
        <Script
          id={`outbid-reference-script-${index}`}
          key={`outbid-reference-script-${index}`}
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: index === 0 ? `${boot}\n${source}` : source,
          }}
        />
      ))}
    </>
  );
}
