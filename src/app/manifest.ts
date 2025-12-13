import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Foundzie",
    short_name: "Foundzie",
    description: "Lightning-fast personal concierge",
    start_url: "/mobile",
    scope: "/",
    display: "standalone",
    background_color: "#0b1020",
    theme_color: "#0b1020",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
  };
}
