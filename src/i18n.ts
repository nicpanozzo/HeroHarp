// Testi del gioco in italiano e inglese.

export type Lang = "it" | "en";

const STRINGS = {
  title: { it: "Duello d'Ance", en: "Reed Duel" },
  tagline: { it: "Impara l'armonica a colpi di blues", en: "Learn the harmonica one blues battle at a time" },
  harpKey: { it: "La tua armonica", en: "Your harmonica" },
  language: { it: "Lingua", en: "Language" },
  start: { it: "Inizia", en: "Start" },
  micAsk: { it: "Il gioco ascolta la tua armonica: consenti l'uso del microfono.", en: "The game listens to your harmonica: allow microphone access." },
  micDenied: { it: "Microfono non disponibile. Puoi giocare con la tastiera: 1-0 soffio, Q-P aspirato.", en: "Microphone unavailable. You can play with the keyboard: 1-0 blow, Q-P draw." },
  keyboardHint: { it: "Tastiera: 1-0 soffio · Q-P aspirato", en: "Keyboard: 1-0 blow · Q-P draw" },
  area1: { it: "Area 1 · Il primo soffio", en: "Area 1 · The First Breath" },
  area1Desc: { it: "Note singole sui fori 4-7. Ascolta il nemico e ripeti la sua frase.", en: "Single notes on holes 4-7. Listen to the enemy and play their phrase back." },
  locked: { it: "Sconfiggi gli altri due per sbloccarlo", en: "Defeat the other two to unlock" },
  beaten: { it: "Sconfitto", en: "Defeated" },
  fight: { it: "Combatti", en: "Fight" },
  countin: { it: "Pronti...", en: "Ready..." },
  call: { it: "Ascolta", en: "Listen" },
  response: { it: "Rispondi!", en: "Your turn!" },
  volley: { it: "Para!", en: "Parry!" },
  onTime: { it: "A tempo!", en: "On beat!" },
  combo: { it: "Combo", en: "Combo" },
  wrong: { it: "Nota sbagliata", en: "Wrong note" },
  easier: { it: "Rallento un po'", en: "Slowing down a bit" },
  harder: { it: "Si fa sul serio", en: "Turning it up" },
  you: { it: "Tu", en: "You" },
  won: { it: "Vittoria!", en: "Victory!" },
  lost: { it: "Sconfitta", en: "Defeat" },
  notesHit: { it: "Note giuste", en: "Notes played" },
  parried: { it: "Colpi parati", en: "Parried" },
  retry: { it: "Riprova", en: "Try again" },
  toMap: { it: "Torna alla mappa", en: "Back to map" },
  areaClear: { it: "Area completata! Prossima tappa: la scala.", en: "Area cleared! Next stop: the scale." },
  hearing: { it: "Senti", en: "Hearing" },
  silence: { it: "silenzio", en: "silence" },
} satisfies Record<string, Record<Lang, string>>;

export type StringId = keyof typeof STRINGS;

let lang: Lang = "it";
export const setLang = (l: Lang) => (lang = l);
export const getLang = () => lang;
export const t = (id: StringId): string => STRINGS[id][lang];
