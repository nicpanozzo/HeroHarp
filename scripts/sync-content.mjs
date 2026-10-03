// Copia nel gioco i contenuti prodotti nella cartella del progetto:
// il percorso didattico (content/percorso.json), gli asset grafici (style/assets),
// i moduli audio e di tema (style/src) e le modalità del Juke Joint (modes/src → src/modi).
// Non modificarli qui: si cambiano nella cartella del progetto.
// Uso: node scripts/sync-content.mjs [cartella del progetto, predefinita ".."]
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const project = resolve(process.argv[2] ?? "..");
const here = resolve(import.meta.dirname, "..");
mkdirSync(`${here}/src/content`, { recursive: true });
cpSync(`${project}/content/percorso.json`, `${here}/src/content/percorso.json`);
cpSync(`${project}/style/assets`, `${here}/src/assets`, { recursive: true });
mkdirSync(`${here}/src/style`, { recursive: true });
for (const f of ["basi.ts", "effetti.ts", "tema.ts"]) cpSync(`${project}/style/src/${f}`, `${here}/src/style/${f}`);

// Modalità: gli alias del loro progetto (@gioco, @stile, @asset, @contenuti) diventano percorsi relativi.
// main.ts e la BootScene restano fuori: nel gioco le scene le registra src/modi.ts e gli SVG li carica il Boot del gioco.
const modi = `${here}/src/modi`;
rmSync(modi, { recursive: true, force: true });
const ALIAS = { "@gioco/": "", "@stile/": "style/", "@asset/": "assets/", "@contenuti/": "content/" };
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(`${dir}/${f}`).isDirectory() ? walk(`${dir}/${f}`) : [`${dir}/${f}`]));
const from = `${project}/modes/src`;
for (const file of walk(from)) {
  const rel = relative(from, file);
  if (rel === "main.ts" || rel === "scene/BootScene.ts" || rel.startsWith("assets/") || rel.endsWith(".css")) continue;
  const out = `${modi}/${rel}`;
  mkdirSync(dirname(out), { recursive: true });
  let src = readFileSync(file, "utf8");
  src = src.replace(/(["'])(@gioco|@stile|@asset|@contenuti)\//g, (_, q, alias) => {
    let path = relative(dirname(out), `${here}/src/${ALIAS[`${alias}/`]}`) || ".";
    if (!path.startsWith(".")) path = `./${path}`;
    return `${q}${path}/`;
  });
  writeFileSync(out, `// Copiato da modes/src/${rel} con scripts/sync-content.mjs, non modificare qui.\n${src}`);
}
console.log(`Contenuti copiati da ${project}`);
