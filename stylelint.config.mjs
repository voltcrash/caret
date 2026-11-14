/** @type {import('stylelint').Config} */
export default {
  extends: ["stylelint-config-standard"],
  rules: {
    "font-family-no-missing-generic-family-keyword": [
      true,
      {
        ignoreFontFamilies: ["Gallaudet"],
      },
    ], //default: true

    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: [
          "theme",
          "utility",
          "tailwind",
          "apply",
          "source",
          "variant",
        ],
      },
    ], // source for lightningCss and the rest for tailwind //default: true
    "at-rule-prelude-no-invalid": [
      true,
      {
        ignoreAtRules: [
          "theme",
          "utility",
          "tailwind",
          "apply",
          "source",
          "variant",
        ],
      },
    ],
    "selector-type-no-unknown": [
      true,
      { ignore: ["custom-elements"], ignoreTypes: ["letter", "hint"] },
    ], // default: [true, {ignore: ['custom-elements'],},]

    "length-zero-no-unit": null, // default: [true, {ignore: ['custom-properties'], ignorePreludeOfAtRules: ['function', 'mixin'],},]

    "value-keyword-case": null, // default: lower

    "at-rule-empty-line-before": null, // default: ['always', {except: ['blockless-after-same-name-blockless', 'first-nested'], ignore: ['after-comment'],},]
    "comment-empty-line-before": null, // default: ['always', {except: ['first-nested'], ignore: ['stylelint-commands'],},]
    "custom-property-empty-line-before": null, // default: 'custom-property-empty-line-before': ['always',{except: ['after-custom-property', 'first-nested'],ignore: ['after-comment', 'inside-single-line-block'],},]
    "declaration-empty-line-before": null, // default: ['always', {except: ['after-declaration', 'first-nested'], ignore: ['after-comment', 'inside-single-line-block'],},]
    "rule-empty-line-before": null, // default: ['always-multi-line', {except: ['first-nested'], ignore: ['after-comment'],},]

    "alpha-value-notation": null, // default: ['percentage',{exceptProperties: ['opacity','fill-opacity','flood-opacity','stop-opacity','stroke-opacity',],},]
    "color-function-alias-notation": null, // default: without-alpha
    "color-function-notation": null, // default: modern
    "color-hex-length": null, // default: short
    "hue-degree-notation": null, // default: angle
    "import-notation": null, // default: url
    "media-feature-range-notation": null, // default: context
    "selector-not-notation": null, // default: complex

    // default pattern for these rules is a kebab case pattern
    "custom-property-pattern": null,
    "keyframes-name-pattern": null,
    "selector-class-pattern": null,
    "selector-id-pattern": null,

    "declaration-block-no-redundant-longhand-properties": null,
    "shorthand-property-no-redundant-values": null,

    "comment-whitespace-inside": null, // default: always
  },
  ignoreFiles: ["**/dist/**", "**/coverage/**", "**/styles/generated/**"],
};
