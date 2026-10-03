// Impostazioni e progressi del giocatore, salvati nel browser quando possibile.

import { setLang, type Lang } from "./i18n";

export interface Save {
  lang: Lang;
  keyId: string;
  beaten: string[];
}

const KEY = "duello-dance-save";
const defaults: Save = { lang: "it", keyId: "C", beaten: [] };

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    /* archiviazione non disponibile: si gioca senza salvataggi */
  }
  return { ...defaults };
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
