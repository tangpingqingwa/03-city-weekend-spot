import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "City Weekend",
    short_name: "City Weekend",
    description: "A transparent paid board for New York City weekends.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff1ed",
    theme_color: "#db765d",
    icons: [{ src: "/brand-mark.png", sizes: "512x512", type: "image/png" }],
  };
}
