// Testi del gioco in italiano e inglese.

export type Lang = "it" | "en";

const STRINGS = {
  title: { it: "Duello d'Ance", en: "Reed Duel" },
  tagline: { it: "Impara l'armonica a colpi di blues", en: "Learn the harmonica one blues battle at a time" },
  harpKey: { it: "La tua armonica", en: "Your harmonica" },
  language: { it: "Lingua", en: "Language" },
  start: { it: "Inizia", en: "Start" },
  micAsk: {
    it: "Il gioco ascolta la tua armonica: consenti l'uso del microfono. Con le cuffie riconosce meglio le note.",
    en: "The game listens to your harmonica: allow microphone access. Headphones help it hear your notes.",
  },
  micDenied: { it: "Microfono non disponibile. Puoi giocare con la tastiera: 1-0 soffio, Q-P aspirato.", en: "Microphone unavailable. You can play with the keyboard: 1-0 blow, Q-P draw." },
  keyboardHint: { it: "Tastiera: 1-0 soffio · Q-P aspirato", en: "Keyboard: 1-0 blow · Q-P draw" },
  area: { it: "Area 1", en: "Area 1" },
  locked: { it: "Batti gli altri tre per sbloccarlo", en: "Beat the other three to unlock" },
  fight: { it: "Combatti", en: "Fight" },
  again: { it: "Rigioca", en: "Replay" },
  boss: { it: "Boss", en: "Boss" },
  maeTitle: { it: "Zia Mae", en: "Aunt Mae" },
  maeIntro: {
    it: "Benvenuto sul mio portico! Prima di partire per la strada del blues devi saper suonare una nota alla volta. Ascolta chi ti sfida e ripeti la sua frase. Poi para i suoi colpi suonando il foro giusto quando arrivano in fondo.",
    en: "Welcome to my porch! Before you hit the blues road you need to play one note at a time. Listen to whoever challenges you and play their phrase back. Then block their shots by playing the right hole when they reach the bottom.",
  },
  maeOk: { it: "Andiamo", en: "Let's go" },
  help: { it: "Come si gioca", en: "How to play" },
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
  harpIn: { it: "armonica in", en: "harp in" },
  hold: { it: "Tienila!", en: "Hold it!" },
  heal: { it: "Il Silenzio si riprende", en: "The Silence recovers" },
  keepPlaying: { it: "Non smettere di suonare!", en: "Keep playing!" },
  bossPhase: { it: "Fase", en: "Phase" },
  won: { it: "Vittoria!", en: "Victory!" },
  lost: { it: "Sconfitta", en: "Defeat" },
  notesHit: { it: "Note giuste", en: "Notes played" },
  parried: { it: "Colpi parati", en: "Parried" },
  retry: { it: "Riprova", en: "Try again" },
  toMap: { it: "Torna alla mappa", en: "Back to map" },
  areaClear: { it: "Area completata! Prossima tappa: la stazione.", en: "Area cleared! Next stop: the station." },
  hearing: { it: "Senti", en: "Hearing" },
  silence: { it: "silenzio", en: "silence" },
} satisfies Record<string, Record<Lang, string>>;

export type StringId = keyof typeof STRINGS;

let lang: Lang = "it";
export const setLang = (l: Lang) => (lang = l);
export const getLang = () => lang;
export const t = (id: StringId): string => STRINGS[id][lang];
