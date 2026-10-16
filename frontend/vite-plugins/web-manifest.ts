import type { Plugin } from "vite-plus";

type WebManifest = {
  id: string;
  short_name: string;
  name: string;
  description: string;
  start_url: string;
  scope: string;
  orientation: "any";
  categories: string[];
  icons: { src: string; sizes: string; type: string; purpose: string }[];
  background_color: string;
  display: "standalone";
  theme_color: string;
};

/** Installed-app identity shared by the rollback PWA and the Start build. */
export const webManifest: Readonly<WebManifest> = {
  id: "/",
  short_name: "Oxytype",
  name: "Oxytype",
  description: "A minimalistic, customizable typing test",
  start_url: "/",
  scope: "/",
  orientation: "any",
  categories: ["education", "productivity"],
  icons: [
    {
      src: "/images/icons/oxytype-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any maskable",
    },
    {
      src: "/images/icons/oxytype-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable",
    },
  ],
  background_color: "#323437",
  display: "standalone",
  theme_color: "#323437",
};

/** Keeps the installed app's existing `/manifest.json` URL. */
const webManifestPath = "/manifest.json";

export function startWebManifest(): Plugin {
  const source = JSON.stringify(webManifest);
  return {
    name: "oxytype-web-manifest",
    applyToEnvironment: (environment) => environment.name === "client",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: webManifestPath.slice(1),
        source,
      });
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== webManifestPath) {
          next();
          return;
        }
        response.setHeader("content-type", "application/manifest+json");
        response.end(source);
      });
    },
  };
}
