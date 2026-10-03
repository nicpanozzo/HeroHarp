// La Lunga Notte: i pezzi con cui si costruisce una run (musicisti, attrezzatura, eventi, testi).
// Solo dati e piccoli effetti sullo stato: nessuna grafica, così si possono testare.

import type { Strumento } from "../style/basi";
import type { L10n } from "../content/areas";

/** Modificatori che la band e l'attrezzatura danno in battaglia. */
export interface Mods {
  /** Moltiplicatore dei danni che fai rispondendo. */
  dmg: number;
  /** Moltiplicatore della finestra di parata. */
  parry: number;
  /** Vita recuperata per ogni nota perfetta. */
  perfectHeal: number;
  /** Danni in più quando la serie è almeno 8. */
  streakDmg: number;
  /** Colpi in meno in ogni raffica. */
  volleyMinus: number;
  /** Colpi assorbiti all'inizio di ogni duello. */
  shield: number;
  /** Vita recuperata dopo ogni vittoria. */
  winHeal: number;
  /** Battiti al minuto in più (o in meno) per i nemici. */
  bpm: number;
  /** Moltiplicatore dei dollari guadagnati. */
  coins: number;
  /** Dollari per ogni nota perfetta. */
  perfectCoin: number;
}

export const BASE_MODS: Mods = { dmg: 1, parry: 1, perfectHeal: 0, streakDmg: 0, volleyMinus: 0, shield: 0, winHeal: 0, bpm: 0, coins: 1, perfectCoin: 0 };

export type MusicianId = "sam" | "earl" | "ruby" | "tito" | "june";
export type GearId = "bullet" | "custodia" | "fazzoletto" | "metronomo" | "ferro" | "scorta" | "ancia" | "cappello" | "diavolo";

export interface Musician {
  id: MusicianId;
  name: string;
  /** Lo strumento che aggiunge alla base. */
  instrument: Strumento;
  role: L10n;
  perk: L10n;
  price: number;
  apply: (m: Mods) => void;
}

export interface Gear {
  id: GearId;
  name: L10n;
  perk: L10n;
  price: number;
  /** Solo dagli eventi, mai in negozio o tra le ricompense. */
  eventOnly?: boolean;
  apply: (m: Mods) => void;
}

/** La vecchia band di Zia Mae: ognuno porta il suo strumento nella base e un aiuto in battaglia. */
export const MUSICIANS: Musician[] = [
  {
    id: "sam",
    name: "Sam",
    instrument: "acustica",
    role: { it: "chitarra acustica", en: "acoustic guitar" },
    perk: { it: "Il groove spinge: +15% danni", en: "The groove pushes: +15% damage" },
    price: 70,
    apply: (m) => void (m.dmg *= 1.15),
  },
  {
    id: "earl",
    name: "Earl",
    instrument: "basso",
    role: { it: "contrabbasso", en: "upright bass" },
    perk: { it: "Il basso tiene il tempo: parate più facili (+30%)", en: "The bass keeps time: easier parries (+30%)" },
    price: 70,
    apply: (m) => void (m.parry *= 1.3),
  },
  {
    id: "ruby",
    name: "Ruby",
    instrument: "piano",
    role: { it: "pianoforte", en: "piano" },
    perk: { it: "Ogni nota perfetta: +2 vita", en: "Every perfect note: +2 health" },
    price: 80,
    apply: (m) => void (m.perfectHeal += 2),
  },
  {
    id: "tito",
    name: "Tito",
    instrument: "batteria",
    role: { it: "batteria", en: "drums" },
    perk: { it: "Serie da 8 in su: +35% danni", en: "Streak of 8 or more: +35% damage" },
    price: 80,
    apply: (m) => void (m.streakDmg += 0.35),
  },
  {
    id: "june",
    name: "June",
    instrument: "elettrica",
    role: { it: "chitarra elettrica", en: "electric guitar" },
    perk: { it: "Copre un colpo: raffiche con un colpo in meno", en: "Covers a shot: one shot fewer per volley" },
    price: 90,
    apply: (m) => void (m.volleyMinus += 1),
  },
];

export const GEAR: Gear[] = [
  {
    id: "bullet",
    name: { it: "Microfono Bullet", en: "Bullet mic" },
    perk: { it: "Il suono di Chicago: +20% danni", en: "The Chicago sound: +20% damage" },
    price: 60,
    apply: (m) => void (m.dmg *= 1.2),
  },
  {
    id: "custodia",
    name: { it: "Custodia di cuoio", en: "Leather case" },
    perk: { it: "Il primo colpo di ogni duello non fa male", en: "The first hit of every duel doesn't hurt" },
    price: 50,
    apply: (m) => void (m.shield += 1),
  },
  {
    id: "fazzoletto",
    name: { it: "Fazzoletto di Zia Mae", en: "Aunt Mae's handkerchief" },
    perk: { it: "+12 vita dopo ogni vittoria", en: "+12 health after every win" },
    price: 55,
    apply: (m) => void (m.winHeal += 12),
  },
  {
    id: "metronomo",
    name: { it: "Metronomo tascabile", en: "Pocket metronome" },
    perk: { it: "I nemici suonano più lenti (−8 bpm)", en: "Enemies play slower (−8 bpm)" },
    price: 50,
    apply: (m) => void (m.bpm -= 8),
  },
  {
    id: "ferro",
    name: { it: "Ferro di cavallo", en: "Horseshoe" },
    perk: { it: "+40% dollari", en: "+40% dollars" },
    price: 45,
    apply: (m) => void (m.coins *= 1.4),
  },
  {
    id: "scorta",
    name: { it: "Armonica di scorta", en: "Spare harmonica" },
    perk: { it: "Se cadi, riparti una volta con 40 vita", en: "If you fall, get back up once with 40 health" },
    price: 75,
    apply: () => undefined,
  },
  {
    id: "ancia",
    name: { it: "Ance nuove", en: "Fresh reeds" },
    perk: { it: "+20 vita massima", en: "+20 max health" },
    price: 55,
    apply: () => undefined,
  },
  {
    id: "cappello",
    name: { it: "Cappello da busker", en: "Busker's hat" },
    perk: { it: "+2 dollari per ogni nota perfetta", en: "+2 dollars for every perfect note" },
    price: 45,
    apply: (m) => void (m.perfectCoin += 2),
  },
  {
    id: "diavolo",
    name: { it: "Ancia del crocevia", en: "Crossroads reed" },
    perk: { it: "+40% danni, ma −20 vita massima", en: "+40% damage, but −20 max health" },
    price: 0,
    eventOnly: true,
    apply: (m) => void (m.dmg *= 1.4),
  },
];

export const musicianById = (id: string): Musician => MUSICIANS.find((m) => m.id === id)!;
export const gearById = (id: string): Gear => GEAR.find((g) => g.id === id)!;

/** Il groove della notte: si sceglie al juke-box e cambia sia la base sia il gioco. */
export type Groove = "shuffle" | "dritto";
export const GROOVES: Record<Groove, { name: L10n; perk: L10n; apply: (m: Mods) => void }> = {
  shuffle: {
    name: { it: "Shuffle", en: "Shuffle" },
    perk: { it: "Il passo del blues: parate +10%", en: "The blues lope: parries +10%" },
    apply: (m) => void (m.parry *= 1.1),
  },
  dritto: {
    name: { it: "Dritto", en: "Straight" },
    perk: { it: "Ritmo da treno: danni +10%", en: "Train rhythm: damage +10%" },
    apply: (m) => void (m.dmg *= 1.1),
  },
};

// ---------- testi ----------

export const S = {
  title: { it: "La Lunga Notte", en: "The Long Night" },
  tagline: {
    it: "Una strada diversa ogni sera: scegli dove andare, ricostruisci la band, arriva all'alba.",
    en: "A different road every night: choose your way, rebuild the band, make it to dawn.",
  },
  pickRoad: { it: "Da dove parti stanotte?", en: "Where do you start tonight?" },
  review: { it: "Ripasso", en: "Review" },
  yourStop: { it: "La tua tappa", en: "Your stop" },
  challenge: { it: "Sfida", en: "Challenge" },
  recommended: { it: "consigliata", en: "recommended" },
  coinsBonus: { it: "dollari ×{n}", en: "dollars ×{n}" },
  continueRun: { it: "Continua la notte", en: "Continue the night" },
  newRun: { it: "Nuova notte", en: "New night" },
  act: { it: "Atto {n}", en: "Act {n}" },
  technique: { it: "Tecnica", en: "Technique" },
  goal: { it: "Obiettivo", en: "Goal" },
  go: { it: "Si parte", en: "Let's go" },
  pickNode: { it: "Tocca una tappa illuminata", en: "Tap a lit stop" },
  fight: { it: "Duello", en: "Duel" },
  elite: { it: "Duello duro", en: "Tough duel" },
  rest: { it: "Portico di Zia Mae", en: "Aunt Mae's porch" },
  shop: { it: "Banco dei pegni", en: "Pawn shop" },
  event: { it: "Crocevia", en: "Crossroads" },
  boss: { it: "Boss", en: "Boss" },
  band: { it: "Band", en: "Band" },
  gear: { it: "Attrezzi", en: "Gear" },
  footOnly: { it: "solo il tuo piede", en: "just your foot" },
  reward: { it: "Scegli una ricompensa", en: "Pick a reward" },
  skip: { it: "Salta", en: "Skip" },
  joins: { it: "{name} si unisce alla band!", en: "{name} joins the band!" },
  got: { it: "Ottieni: {name}", en: "You get: {name}" },
  heal: { it: "Cura +{n}", en: "Heal +{n}" },
  healHint: { it: "Un bicchiere d'acqua e un po' di fiato", en: "A glass of water and some breath" },
  restTitle: { it: "Zia Mae ti aspetta sul portico", en: "Aunt Mae is waiting on the porch" },
  restRest: { it: "Riposa", en: "Rest" },
  restRestHint: { it: "+{n} vita", en: "+{n} health" },
  restLesson: { it: "Lezione", en: "Lesson" },
  restLessonHint: { it: "+8 vita massima e un trucco di Zia Mae", en: "+8 max health and one of Aunt Mae's tricks" },
  shopTitle: { it: "Il banco dei pegni", en: "The pawn shop" },
  buy: { it: "Compra", en: "Buy" },
  sold: { it: "Venduto", en: "Sold" },
  tooPoor: { it: "Servono più dollari", en: "You need more dollars" },
  leave: { it: "Riparti", en: "Move on" },
  victory: { it: "L'alba!", en: "Dawn!" },
  defeat: { it: "La notte finisce qui", en: "The night ends here" },
  victorySub: { it: "Hai suonato fino al mattino.", en: "You played until morning." },
  defeatSub: { it: "Domani sera si riparte, più forti.", en: "Tomorrow night you go again, stronger." },
  report: { it: "La pagella della notte", en: "Tonight's report card" },
  toPractise: { it: "Fori da ripassare", en: "Holes to practise" },
  allClean: { it: "Nessun foro da ripassare: pulito!", en: "No holes to practise: clean!" },
  practiseHint: { it: "Allenali nel Dojo, poi torna in strada.", en: "Drill them in the Dojo, then hit the road again." },
  reached: { it: "Arrivato all'atto {n} di 3", en: "Reached act {n} of 3" },
  fightsWon: { it: "Duelli vinti", en: "Duels won" },
  accuracy: { it: "Note giuste", en: "Notes hit" },
  totalScore: { it: "Punti", en: "Score" },
  bestRun: { it: "Record: {n}", en: "Best: {n}" },
  again: { it: "Un'altra notte", en: "Another night" },
  dojo: { it: "Dojo", en: "Dojo" },
  title2: { it: "Titolo", en: "Title" },
  back: { it: "Indietro", en: "Back" },
  spare: { it: "Armonica di scorta! Si riparte", en: "Spare harmonica! Back in it" },
  shielded: { it: "Parato dalla custodia", en: "Blocked by the case" },
  coinsWon: { it: "+{n} dollari", en: "+{n} dollars" },
  lessonFrom: { it: "Zia Mae: {title}", en: "Aunt Mae: {title}" },
  ok: { it: "Ricevuto", en: "Got it" },
  nightNo: { it: "Notte n. {n}", en: "Night #{n}" },
} satisfies Record<string, L10n>;

export type StringKey = keyof typeof S;

// ---------- eventi del crocevia ----------

export interface EventChoice {
  label: L10n;
  hint: L10n;
  /** Disponibile solo se la condizione vale (es. abbastanza dollari). */
  can?: (r: EventRun) => boolean;
  /** Effetto sulla run; restituisce un messaggio facoltativo da mostrare. */
  apply: (r: EventRun) => L10n | void;
}

/** Ciò che un evento può toccare della run (sottoinsieme di RunState, per non dipendere dal file della run). */
export interface EventRun {
  hp: number;
  maxHp: number;
  coins: number;
  band: MusicianId[];
  gear: GearId[];
  groove: Groove;
  bpmShift: number;
  rng: () => number;
}

export interface RunEvent {
  id: string;
  title: L10n;
  text: L10n;
  /** Sprite da mostrare (chiave della texture). */
  art: string;
  choices: EventChoice[];
}

const heal = (r: EventRun, n: number) => (r.hp = Math.min(r.maxHp, r.hp + n));

export const EVENTS: RunEvent[] = [
  {
    id: "stranger",
    title: { it: "Lo sconosciuto al crocevia", en: "The stranger at the crossroads" },
    text: {
      it: "Sotto il lampione un tipo elegante ti porge un'ancia che brilla. «Suonerai come nessuno. Costa solo un po' di fiato.»",
      en: "Under the streetlight a sharp-dressed man offers you a gleaming reed. “You'll play like nobody else. It only costs a little breath.”",
    },
    art: "nemici-corvo-idle",
    choices: [
      {
        label: { it: "Prendi l'ancia", en: "Take the reed" },
        hint: { it: "+40% danni, −20 vita massima", en: "+40% damage, −20 max health" },
        can: (r) => !r.gear.includes("diavolo"),
        apply: (r) => {
          r.gear.push("diavolo");
          r.maxHp = Math.max(30, r.maxHp - 20);
          r.hp = Math.min(r.hp, r.maxHp);
        },
      },
      {
        label: { it: "Tira dritto", en: "Walk on" },
        hint: { it: "Il blues lo impari da te", en: "You'll learn the blues yourself" },
        apply: () => undefined,
      },
    ],
  },
  {
    id: "jukebox",
    title: { it: "Il juke-box", en: "The jukebox" },
    text: {
      it: "Un juke-box gracchia in un angolo. Che groove deve suonare la tua band stanotte?",
      en: "A jukebox crackles in the corner. What groove should your band play tonight?",
    },
    art: "nemici-stonato-idle",
    choices: [
      {
        label: GROOVES.shuffle.name,
        hint: GROOVES.shuffle.perk,
        apply: (r) => void (r.groove = "shuffle"),
      },
      {
        label: GROOVES.dritto.name,
        hint: GROOVES.dritto.perk,
        apply: (r) => void (r.groove = "dritto"),
      },
    ],
  },
  {
    id: "busker",
    title: { it: "Il busker della stazione", en: "The station busker" },
    text: {
      it: "Un vecchio suona sui gradini della stazione. Ti fa posto accanto a sé.",
      en: "An old man plays on the station steps. He makes room for you beside him.",
    },
    art: "nemici-vagabondo-idle",
    choices: [
      {
        label: { it: "Suonate per i passanti", en: "Play for the passers-by" },
        hint: { it: "+35 dollari", en: "+35 dollars" },
        apply: (r) => void (r.coins += 35),
      },
      {
        label: { it: "Ascolta e impara", en: "Listen and learn" },
        hint: { it: "+10 vita massima", en: "+10 max health" },
        apply: (r) => {
          r.maxHp += 10;
          heal(r, 10);
        },
      },
    ],
  },
  {
    id: "storm",
    title: { it: "Temporale sulla strada", en: "Storm on the road" },
    text: {
      it: "Il cielo si apre. Il prossimo locale è lontano, ma stanotte paga bene.",
      en: "The sky opens up. The next club is far, but it pays well tonight.",
    },
    art: "nemici-sospiro-idle",
    choices: [
      {
        label: { it: "Corri sotto la pioggia", en: "Run through the rain" },
        hint: { it: "−12 vita, +45 dollari", en: "−12 health, +45 dollars" },
        can: (r) => r.hp > 12,
        apply: (r) => {
          r.hp -= 12;
          r.coins += 45;
        },
      },
      {
        label: { it: "Aspetta sotto la tettoia", en: "Wait under the porch roof" },
        hint: { it: "+10 vita", en: "+10 health" },
        apply: (r) => void heal(r, 10),
      },
    ],
  },
  {
    id: "tempo",
    title: { it: "Il batterista ubriaco di caffè", en: "The over-caffeinated drummer" },
    text: {
      it: "Il batterista del locale vuole cambiare il tempo a tutta la serata.",
      en: "The house drummer wants to change the tempo for the whole night.",
    },
    art: "nemici-metronomo-idle",
    choices: [
      {
        label: { it: "Più veloce!", en: "Faster!" },
        hint: { it: "Nemici +6 bpm, +60 dollari", en: "Enemies +6 bpm, +60 dollars" },
        apply: (r) => {
          r.bpmShift += 6;
          r.coins += 60;
        },
      },
      {
        label: { it: "Più lento, per favore", en: "Slower, please" },
        hint: { it: "Nemici −6 bpm", en: "Enemies −6 bpm" },
        apply: (r) => void (r.bpmShift -= 6),
      },
    ],
  },
  {
    id: "backroom",
    title: { it: "Jam nel retro", en: "Back-room jam" },
    text: {
      it: "Dal retro del locale arriva una jam infuocata. Qualcuno potrebbe seguirti.",
      en: "A blazing jam spills out of the back room. Someone might follow you.",
    },
    art: "nemici-sassofono-idle",
    choices: [
      {
        label: { it: "Entra a suonare", en: "Go in and play" },
        hint: { it: "−15 vita, un musicista si unisce", en: "−15 health, a musician joins" },
        can: (r) => r.hp > 15 && r.band.length < MUSICIANS.length,
        apply: (r) => {
          r.hp -= 15;
          const free = MUSICIANS.filter((m) => !r.band.includes(m.id));
          const m = free[Math.floor(r.rng() * free.length)];
          r.band.push(m.id);
          return { it: `${m.name} si unisce alla band!`, en: `${m.name} joins the band!` };
        },
      },
      {
        label: { it: "Ascolta dalla porta", en: "Listen from the door" },
        hint: { it: "+15 dollari di mance", en: "+15 dollars in tips" },
        apply: (r) => void (r.coins += 15),
      },
    ],
  },
];

export const eventById = (id: string): RunEvent => EVENTS.find((e) => e.id === id)!;
