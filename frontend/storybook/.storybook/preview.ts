import addonA11y from "@storybook/addon-a11y";
import addonDocs from "@storybook/addon-docs";
import { definePreview } from "storybook-solidjs-vite";

import "../stories/app.css";
import "../stories/storybook-theme.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "balloon-css/balloon.min.css";

import { ThemesList } from "../../src/ts/constants/themes";
import { AppDecorator } from "./AppDecorator";
import { ThemeDecorator } from "./ThemeDecorator";

const tailwindViewports = {
  xxs: { name: "xxs (331px)", styles: { width: "331px", height: "900px" } },
  xs: { name: "xs (426px)", styles: { width: "426px", height: "900px" } },
  sm: { name: "sm (640px)", styles: { width: "640px", height: "900px" } },
  md: { name: "md (768px)", styles: { width: "768px", height: "900px" } },
  lg: { name: "lg (1024px)", styles: { width: "1024px", height: "900px" } },
  xl: { name: "xl (1280px)", styles: { width: "1280px", height: "900px" } },
  "2xl": {
    name: "2xl (1536px)",
    styles: { width: "1536px", height: "900px" },
  },
};

export default definePreview({
  addons: [addonDocs(), addonA11y()],
  globalTypes: {
    theme: {
      description: "Global theme for components",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        items: ThemesList.sort((a, b) => a.name.localeCompare(b.name)).map(
          (t) => ({
            value: t.name,
            title: t.name.replace(/_/g, " "),
          }),
        ),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "rust",
  },
  // Decorators apply innermost first: the theme renders inside the application.
  decorators: [ThemeDecorator, AppDecorator],
  parameters: {
    layout: "centered",
    // automatically create action args for all props that start with 'on'
    actions: {
      argTypesRegex: "^on.*",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    viewport: {
      options: tailwindViewports,
    },
  },
  // All components will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  // tags: ['autodocs'],
});
