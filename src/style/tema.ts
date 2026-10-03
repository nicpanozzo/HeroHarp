// Token di stile condivisi tra canvas (Phaser) e interfaccia HTML. Vedi style/guida-stile.md.

export const COLORI = {
  carta: "#F1E4C8",
  carta2: "#E6D3AE",
  inchiostro: "#1E1A17",
  ottone: "#E09A2B",       // soffio ↑
  indaco: "#3E6FB0",       // aspirato ↓
  indacoChiaro: "#8FB3E6", // aspirato su fondo scuro
  prugna: "#7A3E9D",       // bend, mosse speciali
  rosso: "#C8442F",        // danno, vita del nemico
  palcoScuro: "#2A2018",   // fondo del pannello di battaglia
} as const;

/** Stessi colori come numeri, per Phaser (es. this.add.rectangle(x, y, w, h, COLORI_NUM.ottone)). */
export const COLORI_NUM = Object.fromEntries(
  Object.entries(COLORI).map(([k, v]) => [k, parseInt(v.slice(1), 16)]),
) as { [K in keyof typeof COLORI]: number };

export const FONT = {
  titoli: "'Alfa Slab One', Rockwell, Georgia, serif",
  testo: "'Atkinson Hyperlegible', Verdana, system-ui, sans-serif",
  fori: "'Atkinson Hyperlegible Mono', Menlo, ui-monospace, monospace",
  /** Da mettere nell'index.html */
  googleFontsUrl: "https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Atkinson+Hyperlegible:wght@400;700&family=Atkinson+Hyperlegible+Mono:wght@500;800&display=swap",
} as const;

/** Colore e icona per direzione del respiro: la forma distingue anche senza colori. */
export const RESPIRO = {
  soffio: { colore: COLORI.ottone, icona: "ui-soffio", proiettile: "ui-colpo-soffio", freccia: "↑" },
  aspirato: { colore: COLORI.indaco, icona: "ui-aspirato", proiettile: "ui-colpo-aspirato", freccia: "↓" },
  bend: { colore: COLORI.prugna, icona: (semitoni: 1 | 2 | 3) => `ui-bend-${semitoni}`, proiettile: "ui-colpo-bend" },
} as const;

/** Livelli di parallasse del portico: velocità relativa allo scorrimento della camera. */
export const SFONDO_PORTICO = [
  { key: "sfondi-portico-1-cielo", parallasse: 0.1 },
  { key: "sfondi-portico-2-casa", parallasse: 0.4 },
  { key: "sfondi-portico-3-primo-piano", parallasse: 1 },
] as const;
