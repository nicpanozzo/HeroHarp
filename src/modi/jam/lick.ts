// Copiato da modes/src/jam/lick.ts con scripts/sync-content.mjs, non modificare qui.
// Lick da collezionare nella Jam Libera: frasi idiomatiche del blues in seconda posizione,
// scritte da noi in intavolatura (valgono per ogni tonalità dell'armonica).
// Quando il giocatore ne suona uno, il gioco lo riconosce e lo aggiunge alla collezione.

export interface Lick {
  id: string;
  nome: { it: string; en: string };
  descr: { it: string; en: string };
  fori: string[];
}

export const LICK: Lick[] = [
  {
    id: "scala",
    nome: { it: "Scala blues in salita", en: "Blues scale climb" },
    descr: { it: "Le cinque note del blues sul 4, 5 e 6.", en: "The five blues notes on holes 4, 5 and 6." },
    fori: ["4↑", "4↓'", "4↓", "5↓", "6↑"],
  },
  {
    id: "discesa",
    nome: { it: "La discesa", en: "The way down" },
    descr: { it: "Dal 6 soffiato giù fino a casa.", en: "From 6 blow all the way home." },
    fori: ["6↑", "5↓", "4↓", "4↑", "3↓'", "2↓"],
  },
  {
    id: "sorriso",
    nome: { it: "Il sorriso storto", en: "The crooked smile" },
    descr: { it: "Terza blue piegata che si scioglie sulla tonica.", en: "A bent blue third melting into the root." },
    fori: ["3↓'", "3↓", "2↓"],
  },
  {
    id: "cromatica",
    nome: { it: "Scaletta cromatica", en: "Chromatic stairs" },
    descr: { it: "Quattro gradini di mezzo tono, l'ultimo piegato.", en: "Four half-step stairs, the last one bent." },
    fori: ["4↓", "4↑", "3↓", "3↓'", "2↓"],
  },
  {
    id: "ottava",
    nome: { it: "Salto d'ottava", en: "Octave leap" },
    descr: { it: "La tonica sotto e la tonica sopra.", en: "Low root, high root." },
    fori: ["2↓", "6↑"],
  },
  {
    id: "trillo",
    nome: { it: "Il trillo del treno", en: "Train trill" },
    descr: { it: "4 e 5 aspirati avanti e indietro, veloci.", en: "4 and 5 draw back and forth, fast." },
    fori: ["4↓", "5↓", "4↓", "5↓", "4↓", "5↓"],
  },
  {
    id: "gancio",
    nome: { it: "Il gancio sul 4", en: "The 4-hole hook" },
    descr: { it: "Piega il 4, rilascia, poi riposa sul soffio.", en: "Bend the 4, release, rest on the blow." },
    fori: ["4↓'", "4↓", "4↑"],
  },
  {
    id: "fischio",
    nome: { it: "Il fischio alto", en: "High whistle" },
    descr: { it: "In cima all'armonica, dove il blues grida.", en: "Up top, where the blues shouts." },
    fori: ["6↑", "6↓", "7↓", "6↓", "6↑"],
  },
  {
    id: "lamento",
    nome: { it: "Il lamento", en: "The cry" },
    descr: { it: "Piega il 6 aspirato e scendi.", en: "Bend 6 draw and come down." },
    fori: ["6↓'", "6↓", "6↑", "5↓"],
  },
  {
    id: "boogie",
    nome: { it: "Il passo del boogie", en: "Boogie walk" },
    descr: { it: "Arpeggio che sale dalla tonica.", en: "An arpeggio climbing from the root." },
    fori: ["2↓", "3↓", "4↓", "5↑", "6↓"],
  },
  {
    id: "fondo",
    nome: { it: "Dal fondo del 2", en: "From the bottom of 2" },
    descr: { it: "Bend profondo che risale piano.", en: "A deep bend rising slowly." },
    fori: ["2↓''", "2↓'", "2↓"],
  },
  {
    id: "domanda",
    nome: { it: "La domanda", en: "The question" },
    descr: { it: "Una frase in alto che resta sospesa.", en: "A high phrase left hanging." },
    fori: ["6↑", "6↓", "6↑", "5↓"],
  },
];
