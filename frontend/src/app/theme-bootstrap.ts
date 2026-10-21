import { defaultThemes } from "@oxytype/typing-core/config/default-config";
import { DEFAULT_THEME_KEY } from "../ts/constants/default-theme";
import { themes } from "../ts/constants/themes";
import { toThemeVars } from "../ts/utils/theme-vars";

const defaultPalettes = JSON.stringify(
  Object.fromEntries(
    defaultThemes.map((name) => [name, toThemeVars(themes[name])]),
  ),
);

/**
 * Trusted, preference-only head script. No session reads or hydration state.
 * Paints the last theme, or on a first visit the browser's flagship default
 * (picking and storing it if needed, like getBrowserDefaultTheme).
 */
export const themeBootstrap = String.raw`(()=>{try{let colors;const saved=localStorage.getItem("themeColors");if(saved===null){if(localStorage.getItem("config")!==null)return;const palettes=${defaultPalettes};let name=localStorage.getItem("${DEFAULT_THEME_KEY}");if(!Object.hasOwn(palettes,name)){const names=Object.keys(palettes);name=names[Math.floor(Math.random()*names.length)];localStorage.setItem("${DEFAULT_THEME_KEY}",name)}colors=palettes[name]}else colors=JSON.parse(saved);if(!colors||typeof colors!=="object")return;const keys=["bg-color","main-color","caret-color","sub-color","sub-alt-color","text-color","error-color","error-extra-color","colorful-error-color","colorful-error-extra-color"];let css="";for(const key of keys){const value=colors[key];if(typeof value==="string"&&/^[\w#(),.%\s-]+$/.test(value))css+="--"+key+":"+value+";"}if(css){const style=document.createElement("style");style.id="themeBootstrap";style.nonce=document.currentScript?.nonce||"";style.textContent=":root:root{"+css+"}";document.head.appendChild(style)}}catch{}})();`;
