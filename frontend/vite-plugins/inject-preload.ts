import { IndexHtmlTransformContext, Plugin } from "vite";
import UnpluginInjectPreload from "unplugin-inject-preload/vite";
import { basename } from "node:path";
export function injectPreload(): Plugin {
  const base = UnpluginInjectPreload({
    files: [
      {
        // Vite already links entry CSS. Only prioritize the startup icon font.
        outputMatch: /webfonts\/fa-solid-900\..*\.woff2$/,
        attributes: {
          as: "font",
          type: "font/woff2",
          rel: "preload",
          crossorigin: true,
        },
      },
    ],
    injectTo: "head-prepend",
  }) as {
    name: string;
    vite: {
      transformIndexHtml: {
        handler: (html: string, ctx: IndexHtmlTransformContext) => string;
      };
    };
  };

  return {
    name: base.name,
    ...base.vite,
    transformIndexHtml(html, ctx) {
      //only add preload to the index.html file
      if (basename(ctx.filename) !== "index.html") {
        return html;
      }
      return base.vite.transformIndexHtml.handler(html, ctx);
    },
  };
}
