// Disegna le icone dell'app (PWA, schermata Home, scheda del browser) con Chromium.
// Uso: node scripts/icons.mjs  →  public/icon-192.png, icon-512.png, apple-touch-icon.png, favicon.png
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const font = resolve(import.meta.dirname, "../node_modules/@fontsource/alfa-slab-one/files/alfa-slab-one-latin-400-normal.woff2");
const holes = Array.from({ length: 10 }, (_, i) => `<rect x="${118 + i * 28}" y="236" width="16" height="22" rx="3" fill="#1E1A17"/>`).join("");
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#E09A2B"/>
  <circle cx="256" cy="256" r="196" fill="#F1E4C8" stroke="#1E1A17" stroke-width="10"/>
  <g transform="rotate(-12 256 256)">
    <rect x="98" y="218" width="324" height="94" rx="14" fill="#1E1A17" transform="translate(8 8)"/>
    <rect x="98" y="218" width="324" height="94" rx="14" fill="#C9CCD1" stroke="#1E1A17" stroke-width="8"/>
    <rect x="106" y="226" width="308" height="42" rx="6" fill="#E6D3AE" stroke="#1E1A17" stroke-width="4"/>
    ${holes}
    <rect x="98" y="278" width="324" height="34" rx="10" fill="#7A3E9D" stroke="#1E1A17" stroke-width="8"/>
  </g>
  <text x="256" y="190" text-anchor="middle" font-family="Alfa" font-size="64" fill="#C8442F">♪ ♫</text>
  <text x="256" y="400" text-anchor="middle" font-family="Alfa" font-size="54" fill="#1E1A17">DUELLO</text>
</svg>`;
const html = `<style>@font-face{font-family:Alfa;src:url(data:font/woff2;base64,${readFileSync(font).toString("base64")})}body{margin:0}</style>${svg}`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 512, height: 512 } });
await p.setContent(html);
await p.evaluate(() => document.fonts.ready);
const out = resolve(import.meta.dirname, "../public");
for (const [name, size] of [
  ["icon-512.png", 512],
  ["icon-192.png", 192],
  ["apple-touch-icon.png", 180],
  ["favicon.png", 48],
]) {
  await p.setViewportSize({ width: size, height: size });
  await p.evaluate((s) => document.querySelector("svg").setAttribute("width", s) || document.querySelector("svg").setAttribute("height", s), size);
  await p.screenshot({ path: `${out}/${name}`, clip: { x: 0, y: 0, width: size, height: size } });
}
await b.close();
console.log("icone in", out);
