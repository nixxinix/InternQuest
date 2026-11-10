import type { MetadataRoute } from "next";

/**
 * Lets phones install InternQuest to the home screen (SPEC: PWA). Opens on
 * Home: signed-out visitors are sent to log in from there, as on the web.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "InternQuest: internships and OJT near you",
    short_name: "InternQuest",
    description: "Find internships and OJT near you that fit your skills, and track every application in one place.",
    id: "/",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#eef2f0",
    theme_color: "#16202a",
    lang: "en-PH",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
