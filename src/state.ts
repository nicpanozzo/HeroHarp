// Impostazioni e progressi del giocatore, salvati nel browser quando possibile.

import { setLang, type Lang } from "./i18n";

export interface Settings {
  /** Base musicale accesa. */
  music: boolean;
  /** Volume della base, 0..1. */
  musicVolume: number;
  /** Metronomo mentre suoni (la base tace). */
  metronome: boolean;
  /** Con le cuffie la base resta bassa invece di spegnersi mentre suoni. */
  headphones: boolean;
  reduceMotion: boolean;
  /** Soglia di volume del microfono misurata dalla calibrazione (null = valore predefinito). */
  micGate: number | null;
  /** Ritardo misurato tra colpo del metronomo e nota sentita, in secondi. */
  latency: number | null;
}

export interface Save {
  lang: Lang;
  keyId: string;
  beaten: string[];
  introSeen: boolean;
  settings: Settings;
}

const KEY = "duello-dance-save";
export const DEFAULT_SETTINGS: Settings = {
  music: true,
  musicVolume: 0.8,
  metronome: true,
  headphones: false,
  reduceMotion: false,
  micGate: null,
  latency: null,
};
const defaults: Save = { lang: "it", keyId: "C", beaten: [], introSeen: false, settings: DEFAULT_SETTINGS };

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return { ...defaults, ...data, settings: { ...DEFAULT_SETTINGS, ...data.settings } };
    }
  } catch {
    /* archiviazione non disponibile: si gioca senza salvataggi */
  }
  return { ...defaults, settings: { ...DEFAULT_SETTINGS } };
}

export const save: Save = load();
setLang(save.lang);

export function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* ignorato */
  }
}
