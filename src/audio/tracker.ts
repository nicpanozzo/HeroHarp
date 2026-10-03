// Trasforma la sequenza grezza di altezze (una per frame) in note stabili e attacchi.
// Separato dal microfono così si può testare con dati finti e con la tastiera.

export interface NoteState {
  /** Nota MIDI intera stabile, o null in silenzio. */
  midi: number | null;
  /** Altezza continua (con i centesimi), utile per il misuratore di bending. */
  midiF: number | null;
  /** Istante (secondi, orologio audio) in cui è iniziata la nota attuale. */
  since: number;
}

export interface Onset {
  midi: number;
  time: number;
}

const STABLE_FRAMES = 3;

export class NoteTracker {
  state: NoteState = { midi: null, midiF: null, since: 0 };
  private candidate: number | null = null;
  private candidateCount = 0;
  private candidateTime = 0;
  private peak = 0;
  private dipped = false;
  private listeners: ((o: Onset) => void)[] = [];

  onOnset(fn: (o: Onset) => void): () => void {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((l) => l !== fn));
  }

  /** midiF null = silenzio o suono non intonato. */
  feed(time: number, midiF: number | null, level: number): void {
    const rounded = midiF === null ? null : Math.round(midiF);
    if (rounded !== this.candidate) {
      this.candidate = rounded;
      this.candidateCount = 1;
      this.candidateTime = time;
    } else {
      this.candidateCount++;
    }
    const stable = this.candidateCount >= STABLE_FRAMES || (rounded === null && this.candidateCount >= 2);

    if (stable && rounded !== this.state.midi) {
      this.state = { midi: rounded, midiF, since: this.candidateTime };
      this.peak = level;
      this.dipped = false;
      if (rounded !== null) this.emit({ midi: rounded, time: this.candidateTime });
      return;
    }
    if (this.state.midi !== null && rounded === this.state.midi) {
      this.state.midiF = midiF;
      // stessa nota riattaccata: il volume scende e poi risale
      if (level > this.peak) this.peak = level;
      if (level < this.peak * 0.45) this.dipped = true;
      else if (this.dipped && level > this.peak * 0.75) {
        this.dipped = false;
        this.state.since = time;
        this.emit({ midi: this.state.midi, time });
      }
    }
  }

  /** Per la tastiera: una nota netta, senza transizioni. */
  force(time: number, midi: number | null): void {
    this.candidate = midi;
    this.candidateCount = STABLE_FRAMES;
    this.state = { midi, midiF: midi, since: time };
    if (midi !== null) this.emit({ midi, time });
  }

  private emit(o: Onset) {
    for (const l of this.listeners) l(o);
  }
}
