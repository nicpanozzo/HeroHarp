// Copia nel gioco i contenuti prodotti nella cartella del progetto:
// il percorso didattico (content/percorso.json), gli asset grafici (style/assets)
// e i moduli audio e di tema (style/src). Non modificarli qui: si cambiano nella cartella del progetto.
// Uso: node scripts/sync-content.mjs [cartella del progetto, predefinita ".."]
import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const project = resolve(process.argv[2] ?? "..");
const here = resolve(import.meta.dirname, "..");
mkdirSync(`${here}/src/content`, { recursive: true });
cpSync(`${project}/content/percorso.json`, `${here}/src/content/percorso.json`);
cpSync(`${project}/style/assets`, `${here}/src/assets`, { recursive: true });
mkdirSync(`${here}/src/style`, { recursive: true });
for (const f of ["basi.ts", "effetti.ts", "tema.ts"]) cpSync(`${project}/style/src/${f}`, `${here}/src/style/${f}`);
console.log(`Contenuti copiati da ${project}`);
