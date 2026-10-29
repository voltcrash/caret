/**
 * Trusted, preference-only head script. No session reads or hydration state.
 * Paints the last saved theme; first visits use the stylesheet's azure default.
 */
export const themeBootstrap = String.raw`(()=>{try{const colors=JSON.parse(localStorage.getItem("themeColors")||"null");if(!colors||typeof colors!=="object")return;const keys=["bg-color","main-color","caret-color","sub-color","sub-alt-color","text-color","error-color","error-extra-color","colorful-error-color","colorful-error-extra-color"];let css="";for(const key of keys){const value=colors[key];if(typeof value==="string"&&/^[\w#(),.%\s-]+$/.test(value))css+="--"+key+":"+value+";"}if(css){const style=document.createElement("style");style.id="themeBootstrap";style.nonce=document.currentScript?.nonce||"";style.textContent=":root:root{"+css+"}";document.head.appendChild(style)}}catch{}})();`;


/** Apply geometry before first paint, independent of application hydration. */
export const appearanceBootstrap = String.raw`(()=>{try{const config=JSON.parse(localStorage.getItem("config")||"null");if(!config||typeof config!=="object")return;const root=document.documentElement;if(typeof config.fontSize==="number"&&Number.isFinite(config.fontSize)&&config.fontSize>=0.5&&config.fontSize<=10)root.style.setProperty("--startup-font-size",config.fontSize+"rem");if(typeof config.fontFamily==="string"&&/^[a-zA-Z0-9_ -]{1,80}$/.test(config.fontFamily))root.style.setProperty("--font",'"'+config.fontFamily.replaceAll("_"," ")+'", "Roboto Mono", "Vazirharf", monospace');if(config.showKeyTips===true)root.style.setProperty("--startup-keytips-display","flex")}catch{}})();`;
