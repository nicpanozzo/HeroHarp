// Analisi del microfono in un AudioWorklet: gira sul thread audio, a passo fisso,
// così il riconoscimento non dipende dai frame della grafica e ogni misura ha l'istante esatto.
import { yin, rms } from "./yin";

/** Campioni tra due analisi: circa 90 misure al secondo. */
export const HOP = 512;
export const WINDOW = 2048;

export interface PitchFrame {
  /** Istante (orologio audio) dell'ultimo campione analizzato. */
  time: number;
  level: number;
  hz: number;
  clarity: number;
}

// Il codice del processore si costruisce dal testo delle funzioni già usate nei test,
// così il rilevatore è uno solo e il file del gioco resta unico (niente file separati da caricare).
const SOURCE = `
const yin = (${yin.toString()});
const rms = (${rms.toString()});
class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(${WINDOW});
    this.since = 0;
    this.gate = 0.002;
    this.port.onmessage = (e) => { if (typeof e.data.gate === "number") this.gate = e.data.gate; };
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    const n = ch.length;
    this.buf.copyWithin(0, n);
    this.buf.set(ch, ${WINDOW} - n);
    this.since += n;
    if (this.since >= ${HOP}) {
      this.since = 0;
      const level = rms(this.buf);
      let hz = 0, clarity = 0;
      if (level >= this.gate) {
        const p = yin(this.buf, sampleRate);
        if (p) { hz = p.hz; clarity = p.clarity; }
      }
      this.port.postMessage({ time: currentTime + n / sampleRate, level, hz, clarity });
    }
    return true;
  }
}
registerProcessor("pitch", PitchProcessor);
`;

/** Crea il nodo di analisi; null se il browser non supporta gli AudioWorklet. */
export async function createPitchNode(ctx: AudioContext, onFrame: (f: PitchFrame) => void): Promise<AudioWorkletNode | null> {
  if (!ctx.audioWorklet) return null;
  // dal web va bene un Blob; aperto come file (file://) Chrome accetta solo un URL data:
  const blob = URL.createObjectURL(new Blob([SOURCE], { type: "text/javascript" }));
  try {
    await ctx.audioWorklet.addModule(blob);
  } catch {
    await ctx.audioWorklet.addModule(`data:text/javascript;charset=utf-8,${encodeURIComponent(SOURCE)}`);
  } finally {
    URL.revokeObjectURL(blob);
  }
  const node = new AudioWorkletNode(ctx, "pitch", { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: "explicit" });
  node.port.onmessage = (e: MessageEvent<PitchFrame>) => onFrame(e.data);
  return node;
}
