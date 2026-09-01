import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/checkout/", "/checkout/complete", "/nyc/checkout", "/nyc/return", "/nyc/click/"],
    },
    sitemap: "https://cityweekend.lol/sitemap.xml",
    host: "https://cityweekend.lol",
  };
}
