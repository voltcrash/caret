export function cleanCustomText(
  text: string,
  pipeDelimiter: boolean,
): string[] {
  if (text === "") return [];
  text = text.normalize();
  text = text.replace(/[\u2000-\u200A\u202F\u205F\u00A0]/g, " ");
  text = text.replace(/ +/gm, " ");
  text = text.replace(/( *(\r\n|\r|\n) *)/g, "\n ");
  return text.split(pipeDelimiter ? "|" : " ").filter((word) => word !== "");
}

export function replaceCustomTextNewlines(
  text: string,
  mode: "space" | "periodSpace",
): string {
  if (mode === "periodSpace") {
    text = text.replace(/\n/gm, ". ");
    text = text.replace(/\.\. /gm, ". ");
    text = text.replace(/ +/gm, " ");
  } else {
    text = text.replace(/\n/gm, " ");
    text = text.replace(/ +/gm, " ");
  }
  return text;
}
