// Copiato da modes/src/riff/riff.ts con scripts/sync-content.mjs, non modificare qui.
// I riff della Strada dei Riff. Scritti da noi in intavolatura, quindi valgono per ogni tonalità.
// Notazione compatta: un token per nota, "foro" = 1 battito, "foro*2" = 2 battiti, "foro/2" = mezzo battito,
// "-" = pausa (anche "-*2", "-/2"), "|" = stanghetta (solo per leggibilità).

import type { Area, Forma, Strumento } from "../../style/basi";
import percorso from "../../content/percorso.json";
import { leggiForo, scriviForo } from "../core/armonica";

export interface NotaRiff { foro: string; inizio: number; durata: number }

export interface Riff {
  id: string;
  nome: { it: string; en: string };
  descr: { it: string; en: string };
  livello: 1 | 2 | 3 | 4 | 5;
  bpm: number;
  posizione: 1 | 2;
  forma: Forma;
  swing: "shuffle" | "dritto";
  band: Strumento[];
  area: Area;
  /** Battiti totali (multiplo di 4). */
  battiti: number;
  note: NotaRiff[];
  origine: "riff" | "percorso";
}

export function leggiRiff(s: string): { note: NotaRiff[]; battiti: number } {
  const note: NotaRiff[] = [];
  let t = 0;
  for (const tok of s.split(/\s+/).filter((x) => x && x !== "|")) {
    const m = /^([^*/]+)(?:([*/])(\d+(?:\.\d+)?))?$/.exec(tok);
    if (!m) throw new Error(`Token non valido: ${tok}`);
    const d = m[2] === "*" ? Number(m[3]) : m[2] === "/" ? 1 / Number(m[3]) : 1;
    if (m[1] !== "-") note.push({ foro: scriviForo(leggiForo(m[1])), inizio: t, durata: d });
    t += d;
  }
  return { note, battiti: Math.ceil(t / 4) * 4 };
}

type Def = Omit<Riff, "note" | "battiti" | "origine"> & { tab: string; volte?: number };

const DEF: Def[] = [
  {
    id: "primi-passi", livello: 1, bpm: 76, posizione: 1, forma: "vamp", swing: "shuffle", band: ["piede", "acustica"], area: "portico",
    nome: { it: "Primi passi", en: "First steps" },
    descr: { it: "Soffio e aspiro sul 4 e sul 5.", en: "Blow and draw on holes 4 and 5." },
    tab: "4↑ 4↓ 5↑ 4↓ | 4↑*2 -*2 | 4↑ 4↓ 5↑ 5↓ | 5↑*2 -*2", volte: 3,
  },
  {
    id: "boogie-portico", livello: 1, bpm: 80, posizione: 2, forma: "vamp", swing: "shuffle", band: ["piede", "acustica", "basso"], area: "portico",
    nome: { it: "Boogie del portico", en: "Porch boogie" },
    descr: { it: "Il passo del boogie in seconda posizione.", en: "The boogie walk in second position." },
    tab: "2↓ 3↓ 4↓ 5↑ | 6↓ 5↑ 4↓ 3↓ | 2↓ 3↓ 4↓ 5↑ | 4↓*2 2↓*2", volte: 3,
  },
  {
    id: "shuffle-12", livello: 2, bpm: 84, posizione: 2, forma: "blues12", swing: "shuffle", band: ["acustica", "basso", "spazzole"], area: "juke",
    nome: { it: "Shuffle a 12 battute", en: "12-bar shuffle" },
    descr: { it: "Segui gli accordi: I, IV e V.", en: "Follow the chords: I, IV and V." },
    tab: [
      "2↓ 3↓ 4↓ 3↓", "2↓ 3↓ 4↓ 3↓", "2↓ 3↓ 4↓ 3↓", "2↓ 3↓ 4↓ 3↓",
      "4↑ 5↑ 6↑ 5↑", "4↑ 5↑ 6↑ 5↑", "2↓ 3↓ 4↓ 3↓", "2↓ 3↓ 4↓ 3↓",
      "4↓ 5↓ 6↓ 5↓", "4↑ 5↑ 6↑ 5↑", "2↓ 3↓ 4↓ 3↓", "4↓ 5↓ 6↓ 5↓",
    ].join(" | "), volte: 1,
  },
  {
    id: "treno-merci", livello: 2, bpm: 100, posizione: 2, forma: "vamp", swing: "dritto", band: ["treno", "basso"], area: "treno",
    nome: { it: "Treno merci", en: "Freight train" },
    descr: { it: "Crome dritte e un fischio lungo.", en: "Straight eighths and a long whistle." },
    tab: "4↓/2 5↓/2 4↓/2 5↓/2 4↓/2 5↓/2 4↓ | 6↑*2 6↓*2 | 4↓/2 5↓/2 4↓/2 5↓/2 4↓/2 5↓/2 4↓ | 2↓*3 -", volte: 3,
  },
  {
    id: "la-risposta", livello: 3, bpm: 76, posizione: 2, forma: "vamp", swing: "shuffle", band: ["acustica", "basso", "spazzole"], area: "juke",
    nome: { it: "La risposta", en: "The answer" },
    descr: { it: "Domanda in alto, risposta col bend.", en: "Question up high, answer with a bend." },
    tab: "6↑ 5↓ 6↑ 6↓ | 6↑*2 -*2 | 4↓' 4↓ 4↑ 3↓' | 2↓*2 -*2", volte: 3,
  },
  {
    id: "scala-blues", livello: 3, bpm: 72, posizione: 2, forma: "vamp", swing: "shuffle", band: ["basso", "spazzole"], area: "crocevia",
    nome: { it: "La scala blues", en: "The blues scale" },
    descr: { it: "Su e giù, con due bend.", en: "Up and down, with two bends." },
    tab: "2↓ 3↓' 4↑ 4↓' | 4↓ 5↓ 6↑*2 | 6↑ 5↓ 4↓ 4↓' | 4↑ 3↓' 2↓*2", volte: 3,
  },
  {
    id: "gancio-chicago", livello: 4, bpm: 92, posizione: 2, forma: "blues12", swing: "shuffle", band: ["basso", "piano", "batteria"], area: "chicago",
    nome: { it: "Il gancio di Chicago", en: "The Chicago hook" },
    descr: { it: "Bend profondi sul 3 e sul 2.", en: "Deep bends on holes 3 and 2." },
    tab: [
      "2↓ 3↓'' 3↓' 2↓", "-*2 2↓' 2↓", "2↓ 3↓'' 3↓' 2↓", "-*2 4↓ 2↓",
      "4↑ 4↓' 4↑ 3↓'", "-*2 3↓' 4↑", "2↓ 3↓'' 3↓' 2↓", "-*2 1↓ 2↓",
      "4↓ 5↓ 4↓ 4↓'", "4↑ 3↓' 4↑*2", "2↓ 3↓'' 3↓' 2↓", "4↓*2 -*2",
    ].join(" | "), volte: 1,
  },
  {
    id: "notte-fonda", livello: 5, bpm: 96, posizione: 2, forma: "vamp", swing: "shuffle", band: ["basso", "batteria", "elettrica"], area: "chicago",
    nome: { it: "Notte fonda", en: "Deep night" },
    descr: { it: "In cima all'armonica e giù con un bend.", en: "Top of the harp and back down with a bend." },
    tab: "6↑ 6↓ 7↓ 8↓ | 9↑*2 8↓ 7↓ | 6↑/2 6↓/2 7↓/2 6↓/2 6↑ 5↓ | 4↓ 4↓' 2↓*2", volte: 3,
  },
  {
    id: "sveglia", livello: 1, bpm: 96, posizione: 1, forma: "vamp", swing: "shuffle", band: ["piede", "acustica"], area: "portico",
    nome: { it: "Sveglia al portico", en: "Porch wake-up" },
    descr: { it: "Veloce ma facile: 4, 5 e 6.", en: "Fast but easy: 4, 5 and 6." },
    tab: "4↑/2 4↓/2 5↑ 4↓ 4↑ | 5↑/2 6↑/2 5↑ 4↓ 4↑ | 4↑/2 4↓/2 5↑ 6↑ 5↑ | 4↓*2 4↑*2", volte: 2,
  },
  {
    id: "passo-orso", livello: 2, bpm: 92, posizione: 2, forma: "vamp", swing: "shuffle", band: ["piede", "acustica", "basso"], area: "juke",
    nome: { it: "Il passo dell'orso", en: "The bear walk" },
    descr: { it: "Un riff pesante sulla tonica.", en: "A heavy riff on the root." },
    tab: "2↓ - 2↓/2 2↓/2 3↓ | 4↓ - 3↓ 2↓ | 2↓ - 2↓/2 2↓/2 3↓ | 4↓ 5↓ 4↓ 2↓", volte: 2,
  },
  {
    id: "locomotiva", livello: 2, bpm: 112, posizione: 2, forma: "vamp", swing: "dritto", band: ["treno", "basso"], area: "treno",
    nome: { it: "Locomotiva", en: "Locomotive" },
    descr: { it: "Ciuf ciuf veloce e fischio.", en: "Fast chug and whistle." },
    tab: "4↓/2 4↓/2 5↓/2 4↓/2 4↓/2 4↓/2 5↓/2 4↓/2 | 6↑ 6↓ 6↑*2 | 4↓/2 4↓/2 5↓/2 4↓/2 4↓/2 4↓/2 5↓/2 4↓/2 | 4↓ 2↓*3", volte: 2,
  },
  {
    id: "turnaround", livello: 3, bpm: 88, posizione: 2, forma: "vamp", swing: "shuffle", band: ["acustica", "basso", "spazzole"], area: "juke",
    nome: { it: "Turnaround", en: "Turnaround" },
    descr: { it: "La discesa che chiude il giro.", en: "The walk-down that ends the chorus." },
    tab: "6↑ 5↓ 5↑ 4↓ | 4↑ 3↓ 3↓' 2↓ | 1↓ 2↓ 3↓ 4↓ | 2↓*2 -*2", volte: 2,
  },
  {
    id: "mezzanotte", livello: 4, bpm: 100, posizione: 2, forma: "vamp", swing: "shuffle", band: ["basso", "piano", "batteria"], area: "beale",
    nome: { it: "Mezzanotte a Memphis", en: "Memphis midnight" },
    descr: { it: "Bend sul 3 e sul 4, di corsa.", en: "Bends on 3 and 4, on the run." },
    tab: "2↓ 3↓'' 3↓' 3↓ | 4↓ 4↓' 4↑ 3↓' | 2↓/2 3↓'/2 2↓ 1↓ 2↓ | 4↓*2 2↓*2", volte: 2,
  },
  {
    id: "tempesta", livello: 5, bpm: 120, posizione: 2, forma: "vamp", swing: "dritto", band: ["basso", "batteria", "elettrica"], area: "chicago",
    nome: { it: "Tempesta", en: "Storm" },
    descr: { it: "Crome a raffica su tutta l'armonica.", en: "Rapid-fire eighths across the harp." },
    tab: "4↓/2 5↓/2 6↑/2 6↓/2 6↑/2 5↓/2 4↓/2 4↓'/2 | 4↑/2 3↓'/2 2↓/2 3↓'/2 4↑/2 4↓/2 5↓/2 4↓/2 | 6↓/2 7↓/2 8↓/2 7↓/2 6↓/2 6↑/2 5↓/2 4↓/2 | 4↓' 4↑ 2↓*2", volte: 2,
  },
];

function costruisci(d: Def): Riff {
  const { note, battiti } = leggiRiff(d.tab);
  // partite corte: al massimo due giri del riff
  const volte = Math.min(2, d.volte ?? 1);
  const tutte: NotaRiff[] = [];
  for (let v = 0; v < volte; v++) for (const n of note) tutte.push({ ...n, inizio: n.inizio + v * battiti });
  const { tab: _t, volte: _v, ...resto } = d;
  return { ...resto, note: tutte, battiti: battiti * volte, origine: "riff" };
}

// ---------- Frasi del percorso didattico (content/percorso.json) ----------

interface EventoP { type: string; notes?: { hole: number; dir: string; bend: number }[]; start: number; dur: number }
interface FraseP { events: EventoP[]; lengthBeats: number }
interface AreaP { id: string; order: number; name: { it: string; en: string }; technique: { it: string; en: string }; bpm: number[]; position?: number; enemies: { phrases?: FraseP[] }[] }

const AREA_STILE: Record<string, { area: Area; band: Strumento[] }> = {
  porch: { area: "portico", band: ["piede", "acustica"] },
  station: { area: "stazione", band: ["piede", "acustica"] },
  "juke-joint": { area: "juke", band: ["acustica", "basso", "spazzole"] },
  "delta-crossroads": { area: "crocevia", band: ["acustica", "basso", "spazzole"] },
  riverboat: { area: "beale", band: ["basso", "piano", "spazzole"] },
  "after-hours": { area: "chicago", band: ["basso", "piano", "batteria"] },
};

/** Le frasi dei nemici di un'area, una dopo l'altra (solo note singole: gli accordi non si riconoscono ancora). */
function daPercorso(a: AreaP, i: number): Riff | null {
  const stile = AREA_STILE[a.id];
  if (!stile) return null;
  const note: NotaRiff[] = [];
  let t = 0;
  for (const nemico of a.enemies) for (const f of nemico.phrases ?? []) {
    if (!f.events.every((e) => e.type === "note" && e.notes?.length === 1)) continue;
    for (const e of f.events) {
      const n = e.notes![0];
      note.push({ foro: scriviForo({ hole: n.hole, draw: n.dir === "draw", bend: n.bend }), inizio: t + e.start, durata: e.dur });
    }
    t += Math.ceil(f.lengthBeats / 4) * 4;
  }
  if (note.length < 6) return null;
  return {
    id: `percorso-${a.id}`, nome: a.name, descr: a.technique, livello: Math.min(5, Math.max(1, Math.ceil((i + 1) * 0.7))) as Riff["livello"],
    bpm: a.bpm[0], posizione: a.position === 2 ? 2 : 1, forma: "vamp", swing: "shuffle", band: stile.band, area: stile.area,
    battiti: Math.ceil(t / 4) * 4, note, origine: "percorso",
  };
}

export const RIFF: Riff[] = DEF.map(costruisci).sort((a, b) => a.livello - b.livello);
export const RIFF_PERCORSO: Riff[] = (percorso as unknown as { areas: AreaP[] }).areas
  .map((a, i) => daPercorso(a, i)).filter((r): r is Riff => r !== null);
export const TUTTI_I_RIFF = [...RIFF, ...RIFF_PERCORSO];
