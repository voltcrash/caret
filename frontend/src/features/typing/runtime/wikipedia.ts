import { getSection as loadSection } from "@oxytype/typing-core/wikipedia";
import { Section } from "@oxytype/typing-core/languages";
import { showLoaderBar, hideLoaderBar } from "../../../ts/states/loader-bar";
import { getLanguage } from "../../../ts/utils/json-data";
import { Language } from "@oxytype/schemas/languages";

export async function getSection(language: Language): Promise<Section> {
  showLoaderBar();
  try {
    return await loadSection(language, {
      getLanguage,
      fetchJson: async (url) => {
        if (!url.includes("/w/api.php")) {
          const response = await fetch(url);
          if (response.status !== 200) {
            throw new Error(`Wikipedia request failed: ${response.status}`);
          }
          return (await response.json()) as unknown;
        }
        return new Promise((resolve, reject) => {
          const request = new XMLHttpRequest();
          request.onload = () => {
            if (request.readyState !== 4) return;
            if (request.status !== 200) {
              reject(request.status);
              return;
            }
            try {
              resolve(JSON.parse(request.responseText));
            } catch (error) {
              reject(error);
            }
          };
          request.onerror = () => {
            reject(new Error("Wikipedia request failed"));
          };
          request.open("GET", url);
          request.send();
        });
      },
      htmlToText: (html) =>
        new DOMParser().parseFromString(`<body>${html}</body>`, "text/html")
          .body.textContent ?? "",
    });
  } finally {
    hideLoaderBar();
  }
}
