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
export type Area = "portico" | "stazione" | "treno" | "juke" | "beale" | "crocevia" | "chicago";
/** Tonalità dell'armonica diatonica (layout Richter). */
export type TonalitaArmonica = "G" | "Ab" | "A" | "Bb" | "B" | "C" | "Db" | "D" | "Eb" | "E" | "F" | "F#";

export interface PresetArea {
  bpm: number;
  /** 1 = la base è nella tonalità dell'armonica; 2 = seconda posizione (una quinta sopra). */
  posizione: 1 | 2;
  forma: Forma;
  swing: "shuffle" | "dritto";
  band: Strumento[];
}

/** Allineato al percorso didattico (content/percorso-didattico.md): la band cresce area dopo area. */
export const PRESET: Record<Area, PresetArea> = {
  portico:  { bpm: 76,  posizione: 1, forma: "vamp",    swing: "shuffle", band: ["piede", "acustica"] },
  stazione: { bpm: 84,  posizione: 1, forma: "quattro", swing: "shuffle", band: ["piede", "acustica"] },
  treno:    { bpm: 108, posizione: 1, forma: "quattro", swing: "dritto",  band: ["treno", "acustica", "basso"] },
  juke:     { bpm: 80,  posizione: 1, forma: "blues12", swing: "shuffle", band: ["acustica", "basso", "piano", "spazzole"] },
  beale:    { bpm: 96,  posizione: 2, forma: "blues12", swing: "shuffle", band: ["basso", "piano", "batteria"] },
  crocevia: { bpm: 66,  posizione: 2, forma: "blues12", swing: "shuffle", band: ["acustica", "basso", "spazzole"] },
  chicago:  { bpm: 108, posizione: 2, forma: "blues12", swing: "shuffle", band: ["basso", "piano", "batteria", "elettrica"] },
};

export interface OpzioniBase extends Partial<PresetArea> {
  area?: Area;
  armonica?: TonalitaArmonica;
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

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class GeneratoreBasi {
  readonly uscita: GainNode;
  private bus: Record<"basso" | "medio" | "ritmo", GainNode>;
  private cfg: PresetArea & { armonica: TonalitaArmonica } = { ...PRESET.portico, armonica: "C" };
  private bpmProssimo: number | null = null;
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
    this.cfg = { ...preset, ...stripUndefined(opz), armonica: opz.armonica ?? "C" } as typeof this.cfg;
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

  /** Cambia il tempo a partire dalla prossima battuta (difficoltà adattiva). */
  impostaTempo(bpm: number) { this.bpmProssimo = Math.max(40, Math.min(200, bpm)); }

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
  gradoInBattuta(battuta: number) { const g = GIRI[this.cfg.forma]; return g[battuta % g.length]; }

  // ---------- Programmazione ----------

  private spostamento() {
    return SPOSTAMENTO_ARMONICA[this.cfg.armonica] + (this.cfg.posizione === 2 ? 7 : 0);
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
    const battito = Math.floor(e / 2), levare = e % 2 === 1;
    // Tonica grave tra Mi1 e Re#2 circa, in modo che il basso non vada troppo giù o su.
    let radice = 40 + ((this.spostamento() % 12) + 12) % 12;
    if (radice > 46) radice -= 12;
    radice += this.gradoInBattuta(this.battuta);
    const ha = (s: Strumento) => this.cfg.band.includes(s);
    const durata = this.durataCroma(e) * 0.95, b = this.durataBattito;

    if (ha("piede") && !levare) this.cassa(t, battito % 2 === 0 ? 0.8 : 0.5);
    if (ha("treno")) { this.rullante(t, levare ? 0.12 : 0.22, true); if (!levare && battito % 2 === 0) this.cassa(t, 0.6); }
    if (ha("spazzole")) { if (!levare && battito % 2 === 1) this.rullante(t, 0.22, true); this.charleston(t, 0.06); }
    if (ha("batteria")) {
      if (!levare && battito % 2 === 0) this.cassa(t, 0.9);
      if (!levare && battito % 2 === 1) this.rullante(t, 0.4);
      this.charleston(t, levare ? 0.07 : 0.13);
    }
    // Boogie sulle corde basse: tonica + quinta / tonica + sesta, alternate a ogni battito.
    const bicordo = battito % 2 === 0 ? 7 : 9;
    if (ha("acustica")) {
      this.pizzico(t, radice + 12, durata, 0.16, this.bus.medio, { taglio: 2600 });
      this.pizzico(t, radice + 12 + bicordo, durata, 0.12, this.bus.medio, { taglio: 2600 });
    }
    if (ha("elettrica")) {
      this.pizzico(t, radice + 12, durata, 0.09, this.bus.medio, { distorsione: true, taglio: 3200, taglioFine: 1200 });
      this.pizzico(t, radice + 12 + bicordo, durata, 0.07, this.bus.medio, { distorsione: true, taglio: 3200, taglioFine: 1200 });
    }
    // Basso camminante: 1 3 5 6 b7 6 5 3 su due battute.
    if (ha("basso") && !levare) {
      const cammino = [0, 4, 7, 9, 10, 9, 7, 4];
      this.pizzico(t, radice + cammino[(this.battuta % 2) * 4 + battito], b * 0.9, 0.35, this.bus.basso, { onda: "triangle", taglio: 900, taglioFine: 300 });
    }
    // Piano: accordo di settima in levare sul 2 e sul 4.
    if (ha("piano") && levare && battito % 2 === 1) {
      for (const iv of [4, 10, 14]) this.pizzico(t, radice + 24 + iv, b * 0.5, 0.07, this.bus.medio, { onda: "triangle", taglio: 3000, taglioFine: 1500 });
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

  private cassa(t: number, v: number) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
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
