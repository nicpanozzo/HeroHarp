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
  /** Tutte le tappe aperte, per allenarsi dove si vuole. */
  openAll: boolean;
}

export interface Save {
  lang: Lang;
  keyId: string;
  beaten: string[];
  introSeen: boolean;
  /** Aree di cui Zia Mae ha già spiegato le lezioni. */
  lessonsSeen: string[];
  /** Record di punti e stelle per nemico. */
  best: Record<string, number>;
  stars: Record<string, number>;
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
  openAll: false,
};
const defaults: Save = { lang: "it", keyId: "C", beaten: [], introSeen: false, lessonsSeen: [], best: {}, stars: {}, settings: DEFAULT_SETTINGS };

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

const MODES_KEY = "duello-dance-juke-joint";
const NIGHT_KEY = "heroharp-lunga-notte";
const readJson = (key: string): unknown => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
};

/** Tutto il salvataggio (viaggio, Juke Joint e Lunga Notte) in un file JSON da scaricare: per cambiare dispositivo o fare una copia. */
export function exportSave(): void {
  persist();
  const data = { app: "heroharp", version: 1, game: save, modes: readJson(MODES_KEY), night: readJson(NIGHT_KEY) };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `heroharp-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Legge un file esportato. Restituisce false se non è un salvataggio valido (e non tocca nulla). */
export function importSave(text: string): boolean {
  try {
    const data = JSON.parse(text);
    if (data?.app !== "heroharp" || typeof data.game !== "object" || !Array.isArray(data.game.beaten)) return false;
    localStorage.setItem(KEY, JSON.stringify(data.game));
    if (data.modes) localStorage.setItem(MODES_KEY, JSON.stringify(data.modes));
    if (data.night) localStorage.setItem(NIGHT_KEY, JSON.stringify(data.night));
    return true;
  } catch {
    return false;
  }
}

/** Apre la scelta del file e, se il salvataggio è valido, ricarica il gioco con i progressi importati. */
export function pickSaveFile(onInvalid: () => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (importSave(await file.text())) location.reload();
    else onInvalid();
  };
  input.click();
}
