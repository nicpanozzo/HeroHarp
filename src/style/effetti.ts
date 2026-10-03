// Effetti sonori e "voce" dei nemici per Duello d'Ance. Solo Web Audio, nessuna dipendenza.
// Regole dalla guida di stile: tutto intonato nella scala della base, niente buzzer punitivi,
// la chiamata del nemico ha il suono di un'armonica (il giocatore impara cosa deve riprodurre).

import { SPOSTAMENTO_ARMONICA, type TonalitaArmonica } from "./basi";

export type Timbro = "normale" | "spiffero" | "sospiro" | "mantice" | "silenzio";

/** Note MIDI del layout Richter in Do. Chiave: "4↑", "4↓", "3↓'", "3↓''", "8↑'"... */
export const RICHTER_C: Record<string, number> = (() => {
  const soffio = [60, 64, 67, 72, 76, 79, 84, 88, 91, 96];
  const aspirato = [62, 67, 71, 74, 77, 81, 83, 86, 89, 93];
  const m: Record<string, number> = {};
  for (let i = 0; i < 10; i++) {
    const h = i + 1;
    m[`${h}↑`] = soffio[i]; m[`${h}↓`] = aspirato[i];
    // bend in aspirazione (fori 1-6) e in soffio (8-10): un apice per semitono
    if (h <= 6) for (let b = 1; b < aspirato[i] - soffio[i]; b++) m[`${h}↓${"'".repeat(b)}`] = aspirato[i] - b;
    if (h >= 8) for (let b = 1; b < soffio[i] - aspirato[i]; b++) m[`${h}↑${"'".repeat(b)}`] = soffio[i] - b;
  }
  return m;
})();

export function foroInMidi(foro: string, armonica: TonalitaArmonica = "C") {
  const base = RICHTER_C[foro.replace(/\s/g, "")];
  if (base === undefined) throw new Error(`Foro sconosciuto: ${foro}`);
  return base + SPOSTAMENTO_ARMONICA[armonica];
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const PENTATONICA = [0, 2, 4, 7, 9, 12, 14, 16];

export class EffettiSonori {
  readonly uscita: GainNode;
  private rumore?: AudioBuffer;
  /** Tonica (MIDI) della base corrente: impostala da `GeneratoreBasi.tonicaMidi`. */
  tonica = 60;
  private serie = 0;

  constructor(readonly ctx: BaseAudioContext, destinazione: AudioNode = ctx.destination) {
    this.uscita = ctx.createGain(); this.uscita.gain.value = 0.8; this.uscita.connect(destinazione);
  }

  /** Nota giusta: un rintocco sulla pentatonica maggiore della base, che sale con la combo (mai stonato). */
  notaGiusta(combo = this.serie++, t = this.ctx.currentTime) {
    const midi = this.tonica + 12 + PENTATONICA[combo % PENTATONICA.length];
    this.campanella(t, midi, 0.18, 0.35);
    this.campanella(t + 0.005, midi + 12, 0.06, 0.25);
  }

  /** Nota mancata: corda stoppata, sorda e breve. */
  notaMancata(t = this.ctx.currentTime) {
    this.serie = 0;
    const o = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    o.type = "triangle"; o.frequency.setValueAtTime(mtof(this.tonica - 24), t); o.frequency.exponentialRampToValueAtTime(mtof(this.tonica - 26), t + 0.12);
    f.type = "lowpass"; f.frequency.value = 600;
    this.inviluppo(g, t, 0.002, 0.35, 0.12);
    o.connect(f).connect(g).connect(this.uscita); o.start(t); o.stop(t + 0.2);
    this.colpoRumore(t, 0.15, 400, 0.05);
  }

  /** Colpo critico / combo: stab di piano (accordo di settima) e un "ooh" del pubblico. */
  critico(t = this.ctx.currentTime) {
    for (const iv of [0, 4, 7, 10, 16]) this.campanella(t, this.tonica + iv, 0.09, 0.5, "triangle");
    const n = this.sorgenteRumore(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = "bandpass"; f.Q.value = 3; f.frequency.setValueAtTime(500, t + 0.05); f.frequency.linearRampToValueAtTime(900, t + 0.5);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    n.connect(f).connect(g).connect(this.uscita); n.start(t); n.stop(t + 0.9);
  }

  /** Il giocatore subisce danno: tonfo grave, non stridente. */
  danno(t = this.ctx.currentTime) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.25);
    this.inviluppo(g, t, 0.003, 0.6, 0.3);
    o.connect(g).connect(this.uscita); o.start(t); o.stop(t + 0.4);
  }

  /** Carica del bend: un ronzio che cresce con `progresso` (0..1). Chiama `rilascia(true)` quando il colpo parte. */
  caricaBend() {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    o.type = "sawtooth"; o2.type = "sawtooth"; o.frequency.value = mtof(this.tonica - 12); o2.frequency.value = mtof(this.tonica - 12) * 1.005;
    f.type = "lowpass"; f.frequency.value = 300; f.Q.value = 6; g.gain.value = 0.0001;
    o.connect(f); o2.connect(f); f.connect(g).connect(this.uscita); o.start(t); o2.start(t);
    return {
      aggiorna: (progresso: number) => {
        const p = Math.max(0, Math.min(1, progresso)), now = this.ctx.currentTime;
        f.frequency.setTargetAtTime(300 + p * 2500, now, 0.03);
        g.gain.setTargetAtTime(0.02 + p * 0.18, now, 0.03);
      },
      rilascia: (successo: boolean) => {
        const now = this.ctx.currentTime;
        g.gain.setTargetAtTime(0.0001, now, 0.04); o.stop(now + 0.3); o2.stop(now + 0.3);
        if (successo) this.critico(now);
      },
    };
  }

  /** Vittoria: la band chiude con un turnaround (discesa cromatica) e l'applauso. */
  vittoria(t = this.ctx.currentTime) {
    const linea = [12, 11, 10, 9, 7];
    linea.forEach((iv, i) => this.campanella(t + i * 0.18, this.tonica + iv, 0.25, 0.3, "triangle"));
    this.campanella(t + 0.95, this.tonica, 0.3, 1.2, "triangle");
    this.campanella(t + 0.95, this.tonica + 7, 0.2, 1.2, "triangle");
    for (let i = 0; i < 40; i++) this.colpoRumore(t + 1 + Math.random() * 1.6, 0.04 + Math.random() * 0.05, 1500 + Math.random() * 1500, 0.03);
  }

  /** Sconfitta: due note che scendono, gentili. */
  sconfitta(t = this.ctx.currentTime) {
    this.campanella(t, this.tonica + 7, 0.2, 0.5, "triangle");
    this.campanella(t + 0.35, this.tonica, 0.2, 0.9, "triangle");
  }

  /**
   * Voce del nemico: un'armonica sintetizzata con un leggero "timbro di carattere".
   * La nota resta sempre riconoscibile, perché il giocatore deve ripeterla.
   */
  voceNemico(midi: number, durata: number, timbro: Timbro = "normale", t = this.ctx.currentTime) {
    const g = this.ctx.createGain(), f = this.ctx.createBiquadFilter(), lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
    const hz = mtof(midi);
    f.type = "bandpass"; f.frequency.value = hz * 2.2; f.Q.value = 0.8;
    lfo.frequency.value = timbro === "sospiro" ? 3.5 : 5.5;
    lg.gain.value = hz * (timbro === "sospiro" ? 0.012 : 0.006);
    lfo.connect(lg);
    for (const [tipo, vol] of [["square", 0.4], ["sawtooth", 0.5]] as const) {
      const o = this.ctx.createOscillator(), og = this.ctx.createGain();
      o.type = tipo; o.frequency.value = hz; lg.connect(o.frequency);
      og.gain.value = vol; o.connect(og).connect(f); o.start(t); o.stop(t + durata + 0.1);
    }
    const picco = timbro === "silenzio" ? 0.18 : 0.32;
    const attacco = timbro === "sospiro" || timbro === "silenzio" ? 0.12 : 0.04;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(picco, t + attacco);
    g.gain.setValueAtTime(picco, t + durata * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + durata);
    f.connect(g).connect(this.uscita);
    lfo.start(t); lfo.stop(t + durata + 0.1);
    // Strato di carattere, sempre sotto la nota
    if (timbro === "spiffero" || timbro === "silenzio") this.soffioRumore(t, durata, timbro === "silenzio" ? 0.12 : 0.06);
    if (timbro === "mantice") this.colpoRumore(t, 0.06, 300, 0.08);
  }

  /**
   * Suona una frase in intavolatura. `fori` es. ["4↑","4↓","5↑"], `durate` in battiti (default 1 ciascuno).
   * Ritorna gli istanti audio di ogni nota, per accendere i fori a schermo.
   */
  suonaFrase(fori: string[], armonica: TonalitaArmonica, durataBattito: number, inizio = this.ctx.currentTime,
             timbro: Timbro = "normale", durate: number[] = []) {
    let t = inizio; const tempi: number[] = [];
    fori.forEach((foro, i) => {
      const d = (durate[i] ?? 1) * durataBattito;
      tempi.push(t);
      if (foro !== "-") this.voceNemico(foroInMidi(foro, armonica), d * 0.92, timbro, t);
      t += d;
    });
    return tempi;
  }

  // ---------- interni ----------
  private inviluppo(g: GainNode, t: number, a: number, picco: number, dec: number) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(picco, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  private campanella(t: number, midi: number, v: number, dec: number, onda: OscillatorType = "sine") {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = onda; o.frequency.value = mtof(midi);
    this.inviluppo(g, t, 0.003, v, dec);
    o.connect(g).connect(this.uscita); o.start(t); o.stop(t + dec + 0.05);
  }
  private sorgenteRumore() {
    if (!this.rumore) {
      this.rumore = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const d = this.rumore.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = this.ctx.createBufferSource(); s.buffer = this.rumore; return s;
  }
  private colpoRumore(t: number, v: number, freq: number, dec: number) {
    const n = this.sorgenteRumore(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = "bandpass"; f.frequency.value = freq; this.inviluppo(g, t, 0.001, v, dec);
    n.connect(f).connect(g).connect(this.uscita); n.start(t); n.stop(t + dec + 0.05);
  }
  private soffioRumore(t: number, durata: number, v: number) {
    const n = this.sorgenteRumore(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = "highpass"; f.frequency.value = 3000;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + durata);
    n.connect(f).connect(g).connect(this.uscita); n.start(t); n.stop(t + durata + 0.05);
  }
}
