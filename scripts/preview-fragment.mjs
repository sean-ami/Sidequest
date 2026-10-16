// Turns dist-preview/index.html into a page fragment for the Claude Artifact host,
// which supplies its own <html>/<head>/<body> skeleton.
import { readFileSync, writeFileSync } from "node:fs";

const file = "dist-preview/index.html";
let html = readFileSync(file, "utf8");
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const keep = head
  .split("\n")
  .filter((l) => !/<meta charset|<meta name="viewport"/.test(l))
  .join("\n")
  .replace(/ crossorigin(?=[ >])/g, "");
writeFileSync(file, `${keep.trim().replace(/<title>.*?<\/title>/, "<title>Side Quest Forge</title>")}\n<style>:root{color-scheme:dark}body{background:#070c21}</style>\n${body.trim()}\n`);
console.log("wrote fragment", file);
