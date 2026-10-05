// Generatore di basi blues per Duello d'Ance.
// Nessuna dipendenza: solo Web Audio. Tutto è programmato sull'orologio dell'AudioContext,
// così il gioco può sincronizzare chiamate, raffiche e animazioni con `tempoBattuta()` / `tempoBattito()`.
//
// Uso tipico:
//   const basi = new GeneratoreBasi(ctx);
//   basi.avvia({ area: "portico", armonica: "C" });
//   basi.suBattuta((n, t) => { ... });        // n = battuta 0,1,2…, t = istante audio
//   basi.impostaRisposta(true);                // il giocatore suona: restano solo basso e ritmo
//   basi.impostaTempo(70);                     // difficoltà adattiva: vale dalla battuta successiva
//   basi.ferma();

export type Strumento = "piede" | "treno" | "acustica" | "basso" | "piano" | "spazzole" | "batteria" | "elettrica";
export type Forma = "vamp" | "quattro" | "blues12";
export type Area = "portico" | "stazione" | "treno" | "juke" | "beale" | "crocevia" | "fiume" | "chicago" | "dopo";
/** Tonalità dell'armonica diatonica (layout Richter). */
export type TonalitaArmonica = "G" | "Ab" | "A" | "Bb" | "B" | "C" | "Db" | "D" | "Eb" | "E" | "F" | "F#";

/** Come cammina il basso in una battuta. */
export type Basso = "cammino" | "boogie" | "radice" | "chicago" | "lento" | "ottave";
/** Come suonano le chitarre (acustica ed elettrica). */
export type Plettro = "boogie" | "chug" | "stab" | "pedale";
/** Come suona il piano. */
export type Tasti = "settime" | "charleston" | "boogie" | "trilli";
/** Come suonano piede, treno, spazzole e batteria. */
export type Ritmo = "base" | "spinto" | "mezzo" | "tom";

/**
 * Un arrangiamento del giro: stessi accordi e stessa band, un altro modo di suonarli.
 * Ogni luogo ne ha cinque: i tre avversari, poi il boss e la sua ultima fase.
 */
export interface Stile {
  nome: { it: string; en: string };
  /** Basso della strofa A e della strofa B: le strofe si alternano a ogni giro. */
  basso: [Basso, Basso];
  plettro: Plettro;
  tasti: Tasti;
  ritmo: Ritmo;
  /** Battimani sul 2 e sul 4: si sentono anche mentre suoni (stanno sul bus del ritmo). */
  battimani?: boolean;
  /** Quick change: la seconda battuta del blues va sul IV. */
  cambioVeloce?: boolean;
  /** Ogni quattro giri, quattro battute di stop-time: la band colpisce solo sull'uno. */
  stopTime?: boolean;
}

export interface PresetArea {
  bpm: number;
  /** 1 = la base è nella tonalità dell'armonica; 2 = seconda posizione (una quinta sopra); 3 = terza posizione (un tono sopra, blues minore). */
  posizione: 1 | 2 | 3;
  /** Accordi minori su I e IV (il V resta di settima), come nel blues minore di terza posizione. */
  minore?: boolean;
  forma: Forma;
  swing: "shuffle" | "dritto";
  band: Strumento[];
  /** Arrangiamenti del luogo, dal più tranquillo al più carico (il primo è quello dei menu e delle modalità). */
  stili: Stile[];
}

/** Scorciatoia per le tabelle: basso "a/b", flag m = battimani, q = quick change, s = stop-time. */
function st(it: string, en: string, basso: string, plettro: Plettro, tasti: Tasti, ritmo: Ritmo, flag = ""): Stile {
  const [a, b = a] = basso.split("/") as Basso[];
  return {
    nome: { it, en }, basso: [a, b], plettro, tasti, ritmo,
    ...(flag.includes("m") && { battimani: true }),
    ...(flag.includes("q") && { cambioVeloce: true }),
    ...(flag.includes("s") && { stopTime: true }),
  };
}

/** Allineato al percorso didattico (content/percorso-didattico.md): la band cresce area dopo area, e in ogni area il groove cambia a ogni avversario. */
export const PRESET: Record<Area, PresetArea> = {
  portico: { bpm: 76, posizione: 1, forma: "vamp", swing: "shuffle", band: ["piede", "acustica"], stili: [
    st("Dondolo del portico", "Porch swing", "cammino", "boogie", "settime", "base"),
    st("Battimani", "Handclaps", "cammino", "chug", "settime", "base", "m"),
    st("Pedale", "Drone", "cammino", "pedale", "settime", "spinto"),
    st("Passo lento", "Slow stomp", "cammino", "stab", "settime", "mezzo", "m"),
    st("Tre e due", "Three-two stomp", "cammino", "boogie", "settime", "tom", "m"),
  ] },
  stazione: { bpm: 84, posizione: 1, forma: "quattro", swing: "shuffle", band: ["piede", "acustica"], stili: [
    st("Sala d'attesa", "Waiting room", "cammino", "boogie", "settime", "base"),
    st("Binario due", "Platform two", "cammino", "chug", "settime", "spinto"),
    st("Fischio lontano", "Distant whistle", "cammino", "pedale", "settime", "base", "m"),
    st("Capostazione", "Stationmaster", "cammino", "stab", "settime", "mezzo", "ms"),
    st("Ultimo treno", "Last train", "cammino", "boogie", "settime", "tom", "m"),
  ] },
  treno: { bpm: 108, posizione: 1, forma: "quattro", swing: "dritto", band: ["treno", "acustica", "basso"], stili: [
    st("Merci in corsa", "Rolling freight", "boogie/ottave", "boogie", "settime", "base"),
    st("Carrozza vuota", "Empty boxcar", "radice/boogie", "chug", "settime", "mezzo"),
    st("Rotaie", "Rails", "ottave/boogie", "pedale", "settime", "spinto"),
    st("Galleria", "Tunnel", "chicago/ottave", "stab", "settime", "tom", "s"),
    st("Locomotiva", "Full steam", "ottave/chicago", "boogie", "settime", "spinto", "s"),
  ] },
  juke: { bpm: 80, posizione: 1, forma: "blues12", swing: "shuffle", band: ["acustica", "basso", "piano", "spazzole"], stili: [
    st("Juke shuffle", "Juke shuffle", "cammino/boogie", "boogie", "settime", "base"),
    st("Pista da ballo", "Dance floor", "boogie/cammino", "chug", "boogie", "spinto"),
    st("Ultimo giro", "Last round", "radice/cammino", "stab", "charleston", "mezzo", "q"),
    st("Padrone del locale", "House rules", "chicago/boogie", "boogie", "trilli", "spinto", "s"),
    st("Chiusura", "Closing time", "boogie/chicago", "stab", "boogie", "tom", "qs"),
  ] },
  beale: { bpm: 96, posizione: 2, forma: "blues12", swing: "shuffle", band: ["basso", "piano", "batteria"], stili: [
    st("Beale Street", "Beale Street", "cammino/boogie", "boogie", "settime", "base"),
    st("Insegne al neon", "Neon signs", "boogie/cammino", "chug", "charleston", "spinto", "q"),
    st("Fiati in strada", "Street horns", "chicago/cammino", "stab", "boogie", "base", "s"),
    st("Re della strada", "King of the street", "ottave/chicago", "stab", "trilli", "spinto", "qs"),
    st("Corona", "Crown", "boogie/ottave", "boogie", "boogie", "tom", "qs"),
  ] },
  crocevia: { bpm: 66, posizione: 2, forma: "blues12", swing: "shuffle", band: ["acustica", "basso", "spazzole"], stili: [
    st("Polvere del Delta", "Delta dust", "radice/lento", "pedale", "settime", "mezzo"),
    st("Mezzanotte", "Midnight", "lento/radice", "boogie", "settime", "base"),
    st("Patto", "The deal", "radice/cammino", "chug", "settime", "tom", "q"),
    st("Ombra lunga", "Long shadow", "lento/chicago", "stab", "settime", "tom", "s"),
    st("All'incrocio", "At the crossroads", "chicago/lento", "pedale", "settime", "spinto", "qs"),
  ] },
  fiume: { bpm: 70, posizione: 3, forma: "blues12", swing: "shuffle", minore: true, band: ["acustica", "basso", "piano", "spazzole"], stili: [
    st("Corrente lenta", "Slow current", "cammino/radice", "boogie", "settime", "base"),
    st("Nebbia", "Fog", "radice/lento", "pedale", "trilli", "mezzo"),
    st("Ruota a pale", "Paddle wheel", "lento/cammino", "chug", "charleston", "base", "q"),
    st("Canto della sirena", "Siren song", "chicago/lento", "stab", "trilli", "tom", "s"),
    st("Piena", "Flood", "boogie/chicago", "boogie", "boogie", "spinto", "qs"),
  ] },
  chicago: { bpm: 108, posizione: 2, forma: "blues12", swing: "shuffle", band: ["basso", "piano", "batteria", "elettrica"], stili: [
    st("South Side", "South Side", "chicago/cammino", "stab", "settime", "base"),
    st("Elettrico", "Plugged in", "cammino/boogie", "boogie", "charleston", "spinto", "q"),
    st("Jam del lunedì", "Monday jam", "ottave/chicago", "chug", "boogie", "base", "s"),
    st("Palco grande", "Main stage", "boogie/ottave", "stab", "trilli", "spinto", "qs"),
    st("Bis", "Encore", "chicago/boogie", "boogie", "boogie", "tom", "qs"),
  ] },
  dopo: { bpm: 92, posizione: 2, forma: "blues12", swing: "shuffle", band: ["basso", "piano", "spazzole"], stili: [
    st("Luci basse", "Low lights", "cammino/lento", "boogie", "settime", "mezzo"),
    st("Fumo", "Smoke", "lento/cammino", "boogie", "charleston", "base"),
    st("Sedie sui tavoli", "Chairs up", "radice/cammino", "boogie", "trilli", "mezzo", "q"),
    st("Fischio di mezzanotte", "Midnight whistle", "chicago/radice", "boogie", "boogie", "spinto", "s"),
    st("Alba", "Daybreak", "boogie/chicago", "boogie", "trilli", "tom", "qs"),
  ] },
};

/** Dagli id delle aree di content/percorso.json ai preset qui sopra. */
export const AREA_DA_PERCORSO: Record<string, Area> = {
  porch: "portico", station: "stazione", "freight-train": "treno", "juke-joint": "juke", "beale-street": "beale",
  "delta-crossroads": "crocevia", riverboat: "fiume", "chicago-club": "chicago", "after-hours": "dopo",
};

export interface OpzioniBase extends Partial<PresetArea> {
  area?: Area;
  armonica?: TonalitaArmonica;
  /** Quale arrangiamento del luogo (0 = quello dei menu). */
  stile?: number;
}

/** Semitoni dell'armonica rispetto a quella in Do (le armoniche in Sol e La sono più gravi). */
export const SPOSTAMENTO_ARMONICA: Record<TonalitaArmonica, number> = {
  G: -5, Ab: -4, A: -3, Bb: -2, B: -1, C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, "F#": 6,
};

/** Gradi (semitoni sopra la tonica) per ogni battuta del giro. */
const GIRI: Record<Forma, number[]> = {
  vamp: [0, 0, 0, 0],                               // sempre sul primo grado: qualunque melodia dell'area 1 ci sta sopra
  quattro: [0, 0, 5, 0, 0, 0, 7, 0],                // I-I-IV-I / I-I-V-I
  blues12: [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7],    // con turnaround sul V
};
const QUICK_CHANGE = [0, 5, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7];

/** Grado dell'accordo nella battuta `battuta` (il quick change vale solo per il blues di 12). */
export function grado(forma: Forma, battuta: number, cambioVeloce = false): number {
  const g = forma === "blues12" && cambioVeloce ? QUICK_CHANGE : GIRI[forma];
  return g[((battuta % g.length) + g.length) % g.length];
}

/** Battute di un "giro" musicale: il blues ne ha 12, le forme corte si ripetono due volte prima di cambiare strofa. */
export const periodo = (forma: Forma) => (forma === "blues12" ? 12 : 8);

/** Un colpo dell'arrangiamento: la voce, la nota (se intonata), il volume e la durata in battiti. */
export type Voce = "cassa" | "rullante" | "spazzola" | "charleston" | "piatto" | "tom" | "battimani" | "basso" | "acustica" | "elettrica" | "piano";
export interface Colpo { voce: Voce; midi?: number; v: number; durata: number }

export interface Momento {
  band: readonly Strumento[];
  stile: Stile;
  forma: Forma;
  minore: boolean;
  /** Battuta assoluta dall'avvio. */
  battuta: number;
  /** Croma della battuta, 0-7. */
  croma: number;
  /** Tonica grave della base (MIDI), prima di aggiungere il grado. */
  tonica: number;
  /** Durata di questa croma in battiti (lo shuffle allunga quelle in battere). */
  durataCroma: number;
}

const CAMMINO = [[0, 4, 7, 9], [10, 9, 7, 4]];
/** Le terze e le seste maggiori diventano minori sugli accordi minori. */
const inMinore = (iv: number, min: boolean) => (min && (iv % 12 === 4 || iv % 12 === 9) ? iv - 1 : iv);
const ALTRO_PLETTRO: Record<Plettro, Plettro> = { boogie: "chug", chug: "boogie", stab: "boogie", pedale: "boogie" };
const ALTRI_TASTI: Record<Tasti, Tasti> = { settime: "boogie", charleston: "settime", boogie: "trilli", trilli: "settime" };

/**
 * Cosa suona la band in una croma. Funzione pura: il generatore la chiama a ogni croma, i test la leggono direttamente.
 * Il giro alterna strofa A e strofa B (altro basso, altro accompagnamento), chiude ogni giro con un break e un fill,
 * e negli stili con lo stop-time ogni quattro giri lascia quattro battute ai soli colpi sull'uno.
 */
export function arrangia(m: Momento): Colpo[] {
  const { stile, forma, battuta, croma: e } = m;
  const out: Colpo[] = [];
  const ha = (s: Strumento) => m.band.includes(s);
  const battito = Math.floor(e / 2), levare = e % 2 === 1;
  const per = periodo(forma), p = battuta % per, giro = Math.floor(battuta / per);
  const strofaB = giro % 2 === 1, ultima = p === per - 1;
  const stop = !!stile.stopTime && giro % 4 === 2 && p < 4;
  const g = grado(forma, battuta, stile.cambioVeloce), gDopo = grado(forma, battuta + 1, stile.cambioVeloce);
  const radice = m.tonica + g;
  const min = m.minore && g !== 7;
  // le linee di due battute ripartono a ogni cambio d'accordo, così l'uno di un accordo nuovo è sempre la sua tonica
  let fermo = 0;
  while (fermo < p && grado(forma, battuta - 1 - fermo, stile.cambioVeloce) === g) fermo++;
  const meta = fermo % 2;
  const croma = m.durataCroma;
  const c = (voce: Voce, v: number, durata = 0.2, midi?: number) => out.push(midi === undefined ? { voce, v, durata } : { voce, midi, v, durata });

  // --- stop-time: un colpo sull'uno, poi solo un tic leggero sui battiti per non perdere il tempo ---
  if (stop) {
    if (e === 0) {
      if (ha("basso")) c("basso", 0.4, 1.2, radice);
      for (const ch of ["acustica", "elettrica"] as const) if (ha(ch)) for (const iv of [12, 19, 22]) c(ch, ch === "acustica" ? 0.12 : 0.07, 1, radice + inMinore(iv, min));
      if (ha("piano")) for (const iv of [4, 10, 14]) c("piano", 0.08, 1, radice + 24 + inMinore(iv, min));
      if (ha("piede") || ha("treno") || ha("batteria")) c("cassa", 0.9);
      if (ha("batteria") || ha("spazzole")) c("piatto", 0.25, 1.5);
    } else if (!levare) {
      if (ha("batteria") || ha("spazzole")) c("charleston", 0.06);
      else c("cassa", 0.25);
    }
    return out;
  }

  // --- ritmo ---
  const fill = ultima && e >= 4;
  if (e === 0 && p === 0 && giro > 0 && (ha("batteria") || ha("spazzole"))) c("piatto", 0.18, 1.5);
  if (fill) {
    // fill di fine giro: rullante in crescendo (o il piede che pesta ogni croma)
    const k = (e - 4) / 3;
    if (ha("batteria") || ha("treno")) c("rullante", 0.15 + 0.3 * k);
    else if (ha("spazzole")) c("spazzola", 0.14 + 0.2 * k);
    if (ha("piede")) c("cassa", 0.45 + 0.35 * k);
    if (e === 4 && (ha("batteria") || ha("treno"))) c("cassa", 0.8);
    if (e === 6 && ha("batteria")) c("tom", 0.5);
  } else {
    const r = stile.ritmo;
    if (ha("piede")) {
      const colpi = r === "mezzo" ? [0, 4] : r === "tom" ? [0, 3, 6] : r === "spinto" ? [0, 2, 4, 6, 7] : [0, 2, 4, 6];
      if (colpi.includes(e)) c("cassa", e === 7 ? 0.35 : battito % 2 === 0 ? 0.8 : 0.5);
    }
    if (ha("treno")) {
      if (r === "mezzo") { if (!levare) c("spazzola", battito % 2 === 1 ? 0.24 : 0.14); }
      else c("rullante", levare ? (r === "spinto" ? 0.16 : 0.12) : 0.22);
      if (!levare && (r === "spinto" || battito % 2 === 0)) c("cassa", 0.6);
      if (r === "tom" && (e === 3 || e === 6)) c("tom", 0.45);
    }
    if (ha("spazzole")) {
      if (r === "mezzo") { if (e === 4) c("spazzola", 0.26); if (!levare) c("charleston", 0.05); }
      else if (r === "tom") { if (e === 0 || e === 3 || e === 6) c("tom", 0.35); c("charleston", 0.05); }
      else {
        if (!levare && battito % 2 === 1) c("spazzola", r === "spinto" ? 0.28 : 0.22);
        if (r === "spinto" && !levare && battito % 2 === 0) c("spazzola", 0.1);
        c("charleston", 0.06);
      }
    }
    if (ha("batteria")) {
      if (r === "mezzo") {
        if (e === 0) c("cassa", 0.9);
        if (e === 4) c("rullante", 0.45);
        if (!levare) c("charleston", 0.11);
      } else if (r === "tom") {
        if (e === 0 || e === 6) c("tom", 0.6);
        if (e === 3) c("tom", 0.45);
        if (e === 4) c("rullante", 0.4);
        c("charleston", levare ? 0.06 : 0.11);
      } else {
        if (!levare && (r === "spinto" || battito % 2 === 0)) c("cassa", battito % 2 === 0 ? 0.9 : 0.6);
        if (!levare && battito % 2 === 1) c("rullante", r === "spinto" ? 0.45 : 0.4);
        // strofa B: charleston aperto, più spinta
        c("charleston", levare ? (strofaB || r === "spinto" ? 0.1 : 0.07) : 0.13);
      }
    }
  }
  if (stile.battimani && !levare && battito % 2 === 1) c("battimani", fill ? 0.35 : 0.25);

  // --- basso ---
  if (ha("basso")) {
    const tipo = stile.basso[strofaB ? 1 : 0];
    let salto = gDopo - g;
    if (salto > 6) salto -= 12;
    if (salto < -6) salto += 12;
    const nota = (iv: number, durata: number, v = 0.35) => c("basso", v, durata, radice + inMinore(iv, min));
    if (ultima && battito >= 1) {
      // fine giro: risalita cromatica verso la tonica del giro dopo
      if (!levare) nota(salto - 4 + battito, 0.9);
    } else {
      // avvicinamento: sul 4 un semitono prima dell'accordo che arriva
      const avvicina = salto !== 0 && battito === 3 && tipo !== "boogie" && tipo !== "ottave";
      if (avvicina) { if (!levare) nota(salto > 0 ? salto - 1 : salto + 1, 0.9); }
      else if (tipo === "cammino") { if (!levare) nota(CAMMINO[meta][battito], 0.9); }
      else if (tipo === "boogie") nota(CAMMINO[meta][battito], croma * 0.9, levare ? 0.26 : 0.34);
      else if (tipo === "radice") { if (e === 0) nota(0, 1.8); if (e === 4) nota(-5, 1.6); if (e === 7) nota(-2, croma * 0.9, 0.25); }
      else if (tipo === "chicago") {
        const riff: Record<number, number> = { 0: 0, 1: 0, 2: 12, 4: 10, 5: 10, 6: 7 };
        if (e in riff) nota(riff[e], e % 2 ? croma * 0.9 : 0.8, e % 2 ? 0.25 : 0.35);
      } else if (tipo === "lento") {
        const linea: Record<number, [number, number]> = { 0: [0, 1.4], 3: [7, 0.4], 4: [12, 0.9], 6: [10, 0.5], 7: [7, 0.3] };
        if (e in linea) nota(linea[e][0], linea[e][1]);
      } else if (tipo === "ottave") nota(levare ? 12 : 0, croma * 0.85, levare ? 0.24 : 0.34);
    }
  }

  // --- chitarre e piano (bus "medio": tacciono mentre risponde il giocatore) ---
  // break di fine giro: un colpo sull'uno e poi spazio al fill
  if (ultima) {
    if (e === 0) {
      for (const ch of ["acustica", "elettrica"] as const) if (ha(ch)) for (const iv of [12, 19, 22]) c(ch, ch === "acustica" ? 0.12 : 0.07, 0.6, radice + inMinore(iv, min));
      if (ha("piano")) for (const iv of [4, 10, 14]) c("piano", 0.07, 0.6, radice + 24 + inMinore(iv, min));
    }
    return out;
  }
  const plettro = strofaB ? ALTRO_PLETTRO[stile.plettro] : stile.plettro;
  for (const ch of ["acustica", "elettrica"] as const) {
    if (!ha(ch)) continue;
    const [v1, v2] = ch === "acustica" ? [0.16, 0.12] : [0.09, 0.07];
    const g1 = radice + 12;
    const corda = (iv: number, v: number, durata: number) => c(ch, v, durata, g1 + inMinore(iv, min));
    if (plettro === "boogie") {
      // boogie sulle corde basse: tonica + quinta / tonica + sesta, alternate a ogni battito
      corda(0, v1, croma * 0.95); corda(battito % 2 === 0 ? 7 : 9, v2, croma * 0.95);
    } else if (plettro === "chug") {
      if (!levare) { corda(0, v1, 0.3); corda(7, v2, 0.3); }
      else if (battito % 2 === 1) corda(9, v2 * 0.8, croma * 0.6);
    } else if (plettro === "stab") {
      if (e === 3 || e === 6) for (const iv of [4, 10, 14]) corda(iv, v2, 0.35);
    } else {
      // pedale: la tonica ribattuta, una blue note di passaggio e la settima in levare sul 4
      corda(0, v2 * 0.9, croma * 0.9);
      if (e === 5) corda(3, v2 * 0.7, croma * 0.8);
      if (e === 7) corda(10, v2, croma * 0.9);
    }
  }
  if (ha("piano")) {
    const tasti = strofaB ? ALTRI_TASTI[stile.tasti] : stile.tasti;
    const acc = (v: number, durata: number, su = 0) => { for (const iv of [4, 10, 14]) c("piano", v, durata, radice + 24 + su + inMinore(iv, min)); };
    if (tasti === "settime") { if (e === 3 || e === 7) acc(0.07, 0.5); }
    else if (tasti === "charleston") { if (e === 0 || e === 3) acc(0.07, 0.35); }
    else if (tasti === "boogie") { if (levare) acc(0.045, croma * 0.8); }
    else {
      // trilli: tremolo acuto sulla prima metà della battuta, poi un accordo sul 4
      if (e < 4) c("piano", 0.05, croma * 0.9, radice + 24 + (e % 2 ? 12 : 7));
      if (e === 6) acc(0.06, 0.45);
    }
  }
  return out;
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class GeneratoreBasi {
  readonly uscita: GainNode;
  private bus: Record<"basso" | "medio" | "ritmo", GainNode>;
  private cfg: PresetArea & { armonica: TonalitaArmonica } = { ...PRESET.portico, armonica: "C" };
  private bpmProssimo: number | null = null;
  private indiceStile = 0;
  private stileProssimo: number | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private passo = 0;                 // croma corrente (8 per battuta)
  private battuta = 0;               // battuta assoluta dall'avvio
  private prossimo = 0;              // istante audio della prossima croma
  private inizioBattuta = 0;         // istante audio dell'inizio della battuta corrente
  private ascoltatoriBattuta: ((n: number, t: number) => void)[] = [];
  private ascoltatoriBattito: ((n: number, t: number) => void)[] = [];
  private rumore?: AudioBuffer;
  private risposta = false;

  constructor(readonly ctx: BaseAudioContext, destinazione: AudioNode = ctx.destination) {
    this.uscita = ctx.createGain();
    this.uscita.gain.value = 0.7;
    const comp = ctx.createDynamicsCompressor();
    this.uscita.connect(comp).connect(destinazione);
    this.bus = {
      basso: this.nuovoBus(), medio: this.nuovoBus(), ritmo: this.nuovoBus(),
    };
  }

  // ---------- API pubblica ----------

  /** Avvia la base. `quando` = istante audio (default: subito). */
  avvia(opz: OpzioniBase = {}, quando = this.ctx.currentTime + 0.05) {
    this.ferma();
    const preset = PRESET[opz.area ?? "portico"];
    const { stile = 0, ...resto } = opz;
    this.cfg = { ...preset, ...stripUndefined(resto), armonica: opz.armonica ?? "C" } as typeof this.cfg;
    this.indiceStile = this.limitaStile(stile); this.stileProssimo = null;
    this.passo = 0; this.battuta = 0; this.prossimo = quando; this.inizioBattuta = quando;
    this.uscita.gain.cancelScheduledValues(quando);
    this.uscita.gain.setValueAtTime(0.7, quando);
    this.impostaRisposta(this.risposta);
    this.timer = setInterval(() => this.programma(), 25);
    this.programma();
  }

  ferma(dissolvenza = 0.08) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const t = this.ctx.currentTime, g = this.uscita.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + dissolvenza);
  }

  get inRiproduzione() { return this.timer !== null; }
  get bpm() { return this.cfg.bpm; }
  get durataBattito() { return 60 / this.cfg.bpm; }
  get durataBattuta() { return 4 * this.durataBattito; }
  /** Tonica della base come nota MIDI (ottava 4), utile per gli effetti "nella scala". */
  get tonicaMidi() { return 60 + this.spostamento(); }
  get posizione() { return this.cfg.posizione; }
  /** true quando la base è un blues minore: gli effetti devono usare la scala minore. */
  get minore() { return !!this.cfg.minore; }

  /** Cambia il tempo a partire dalla prossima battuta (difficoltà adattiva). */
  impostaTempo(bpm: number) { this.bpmProssimo = Math.max(40, Math.min(200, bpm)); }

  /** Arrangiamento in uso (indice negli stili del luogo). */
  get stile() { return this.stileProssimo ?? this.indiceStile; }
  /** Nome dell'arrangiamento in uso. */
  get nomeStile() { return this.cfg.stili[this.stile].nome; }

  /** Cambia arrangiamento dalla prossima battuta, senza fermare la base (es. nuovo avversario o nuova fase del boss). */
  impostaStile(indice: number) {
    const i = this.limitaStile(indice);
    this.stileProssimo = i === this.indiceStile ? null : i;
  }

  private limitaStile(i: number) { return Math.max(0, Math.min(this.cfg.stili.length - 1, Math.floor(i))); }

  /** Strumenti che suonano ora. */
  get band(): readonly Strumento[] { return this.cfg.band; }

  /** Cambia gli strumenti della base al volo (dalla croma successiva), es. quando un musicista si unisce o per una modalità di gioco. */
  impostaBand(band: readonly Strumento[]) { this.cfg.band = [...band]; }

  /** Durante la risposta del giocatore restano solo basso e ritmo: meno rientri nel microfono, più spazio all'armonica. */
  impostaRisposta(attiva: boolean, quando = this.ctx.currentTime) {
    this.risposta = attiva;
    this.bus.medio.gain.setTargetAtTime(attiva ? 0 : 1, quando, 0.05);
  }

  suBattuta(cb: (battuta: number, tempo: number) => void) { this.ascoltatoriBattuta.push(cb); return () => rimuovi(this.ascoltatoriBattuta, cb); }
  suBattito(cb: (battito: number, tempo: number) => void) { this.ascoltatoriBattito.push(cb); return () => rimuovi(this.ascoltatoriBattito, cb); }

  /** Istante audio dell'inizio della prossima battuta (per far partire una chiamata "sul tempo"). */
  prossimaBattuta() { return this.inizioBattuta + this.durataBattuta; }

  /** Istante audio del battito n (0-3) della prossima battuta, oppure di quella corrente se `corrente`. */
  tempoBattito(n: number, corrente = false) {
    const base = corrente ? this.inizioBattuta : this.prossimaBattuta();
    return base + n * this.durataBattito;
  }

  /** Grado dell'accordo (0, 5, 7) che suona in una battuta assoluta. */
  gradoInBattuta(battuta: number) { return grado(this.cfg.forma, battuta, this.cfg.stili[this.stile].cambioVeloce); }

  // ---------- Programmazione ----------

  private spostamento() {
    return SPOSTAMENTO_ARMONICA[this.cfg.armonica] + ({ 1: 0, 2: 7, 3: 2 } as const)[this.cfg.posizione];
  }

  private durataCroma(i: number) {
    const b = this.durataBattito;
    return this.cfg.swing === "dritto" ? b / 2 : (i % 2 === 0 ? b * 2 / 3 : b / 3);
  }

  /** Programma tutte le note fino all'istante `orizzonte`. Utile per rendere la base con un OfflineAudioContext (test, esportazione). */
  programmaFino(orizzonte: number) { this.programma(orizzonte); }

  private programma(orizzonte = this.ctx.currentTime + 0.15) {
    while (this.prossimo < orizzonte) {
      const e = this.passo % 8;
      if (e === 0) {
        if (this.bpmProssimo !== null) { this.cfg.bpm = this.bpmProssimo; this.bpmProssimo = null; }
        if (this.stileProssimo !== null) { this.indiceStile = this.stileProssimo; this.stileProssimo = null; }
        this.inizioBattuta = this.prossimo;
        const n = this.battuta, t = this.prossimo;
        this.ascoltatoriBattuta.forEach(cb => cb(n, t));
      }
      if (e % 2 === 0) { const n = e / 2, t = this.prossimo; this.ascoltatoriBattito.forEach(cb => cb(n, t)); }
      this.suonaCroma(e, this.prossimo);
      this.prossimo += this.durataCroma(e);
      this.passo++;
      if (this.passo % 8 === 0) this.battuta++;
    }
  }

  private suonaCroma(e: number, t: number) {
    // Tonica grave tra Mi1 e Re#2 circa, in modo che il basso non vada troppo giù o su.
    let tonica = 40 + ((this.spostamento() % 12) + 12) % 12;
    if (tonica > 46) tonica -= 12;
    const b = this.durataBattito;
    const colpi = arrangia({
      band: this.cfg.band, stile: this.cfg.stili[this.indiceStile], forma: this.cfg.forma, minore: !!this.cfg.minore,
      battuta: this.battuta, croma: e, tonica, durataCroma: this.durataCroma(e) / b,
    });
    for (const k of colpi) {
      const d = k.durata * b, m = k.midi ?? 0;
      switch (k.voce) {
        case "cassa": this.cassa(t, k.v); break;
        case "tom": this.cassa(t, k.v, 170, 85); break;
        case "rullante": this.rullante(t, k.v); break;
        case "spazzola": this.rullante(t, k.v, true); break;
        case "charleston": this.charleston(t, k.v); break;
        case "piatto": this.piatto(t, k.v, d); break;
        case "battimani": this.battimani(t, k.v); break;
        case "basso": this.pizzico(t, m, d, k.v, this.bus.basso, { onda: "triangle", taglio: 900, taglioFine: 300 }); break;
        case "acustica": this.pizzico(t, m, d, k.v, this.bus.medio, { taglio: 2600 }); break;
        case "elettrica": this.pizzico(t, m, d, k.v, this.bus.medio, { distorsione: true, taglio: 3200, taglioFine: 1200 }); break;
        case "piano": this.pizzico(t, m, d, k.v, this.bus.medio, { onda: "triangle", taglio: 3000, taglioFine: 1500 }); break;
      }
    }
  }

  // ---------- Strumenti sintetizzati (sostituibili con campioni senza cambiare l'API) ----------

  private nuovoBus() { const g = this.ctx.createGain(); g.connect(this.uscita); return g; }

  private inviluppo(g: GainNode, t: number, attacco: number, picco: number, decadimento: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(picco, t + attacco);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attacco + decadimento);
  }

  private sorgenteRumore() {
    if (!this.rumore) {
      this.rumore = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.rumore.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = this.ctx.createBufferSource(); s.buffer = this.rumore; return s;
  }

  private cassa(t: number, v: number, da = 110, a = 42) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(da, t); o.frequency.exponentialRampToValueAtTime(a, t + 0.12);
    this.inviluppo(g, t, 0.003, v, 0.22);
    o.connect(g).connect(this.bus.ritmo); o.start(t); o.stop(t + 0.3);
  }

  private rullante(t: number, v: number, spazzola = false) {
    const n = this.sorgenteRumore(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = spazzola ? "highpass" : "bandpass"; f.frequency.value = spazzola ? 2500 : 1800;
    this.inviluppo(g, t, spazzola ? 0.02 : 0.002, v, spazzola ? 0.18 : 0.14);
    n.connect(f).connect(g).connect(this.bus.ritmo); n.start(t); n.stop(t + 0.3);
  }

  private charleston(t: number, v: number) {
    const n = this.sorgenteRumore(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = "highpass"; f.frequency.value = 7000;
    this.inviluppo(g, t, 0.001, v, 0.05);
    n.connect(f).connect(g).connect(this.bus.ritmo); n.start(t); n.stop(t + 0.1);
  }

  private piatto(t: number, v: number, durata: number) {
    const n = this.sorgenteRumore(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = "highpass"; f.frequency.value = 5000;
    this.inviluppo(g, t, 0.002, v, Math.min(durata, 0.95));
    n.connect(f).connect(g).connect(this.bus.ritmo); n.start(t); n.stop(t + 1);
  }

  /** Battimani: tre raffiche di rumore ravvicinate, come più mani che non battono mai insieme. */
  private battimani(t: number, v: number) {
    for (const [dt, k] of [[0, 1], [0.011, 0.7], [0.023, 0.5]]) {
      const n = this.sorgenteRumore(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      f.type = "bandpass"; f.frequency.value = 1300; f.Q.value = 1.2;
      this.inviluppo(g, t + dt, 0.001, v * k, 0.07);
      n.connect(f).connect(g).connect(this.bus.ritmo); n.start(t + dt); n.stop(t + dt + 0.12);
    }
  }

  private pizzico(t: number, midi: number, durata: number, v: number, bus: AudioNode,
                  o: { onda?: OscillatorType; taglio?: number; taglioFine?: number; distorsione?: boolean } = {}) {
    const osc = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    osc.type = o.onda ?? "sawtooth"; osc.frequency.value = mtof(midi);
    f.type = "lowpass";
    f.frequency.setValueAtTime(o.taglio ?? 2200, t);
    f.frequency.exponentialRampToValueAtTime(o.taglioFine ?? 500, t + durata);
    this.inviluppo(g, t, 0.004, v, durata);
    let nodo: AudioNode = osc.connect(f);
    if (o.distorsione) {
      // Curva a lunghezza dispari: l'ingresso 0 cade esattamente su 0, così il silenzio resta silenzio (niente offset DC).
      const ws = this.ctx.createWaveShaper(), k = 40, curva = new Float32Array(1025);
      for (let i = 0; i < 1025; i++) { const x = i / 512 - 1; curva[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
      ws.curve = curva; nodo = nodo.connect(ws);
    }
    nodo.connect(g).connect(bus);
    osc.start(t); osc.stop(t + durata + 0.05);
  }
}

function rimuovi<T>(arr: T[], x: T) { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); }
function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
