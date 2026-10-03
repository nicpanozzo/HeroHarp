// Area 1, "Il primo soffio": note singole sui fori 4-7, soffio e aspirato.
// Le frasi sono in intavolatura, quindi valgono per qualunque tonalità di armonica.

export interface EnemyDef {
  id: string;
  name: { it: string; en: string };
  taunt: { it: string; en: string };
  /** Colore del corpo e forma, per il disegno procedurale. */
  color: number;
  shape: "blob" | "spiky" | "clock";
  hp: number;
  bpm: number;
  /** Danno inflitto per ogni colpo non parato. */
  attack: number;
  /** Frasi di botta e risposta, dalla più facile alla più difficile. */
  phrases: string[][];
  /** Note usate dalle raffiche di difesa. */
  volleyNotes: string[];
  volleySize: number;
  boss?: boolean;
}

export const AREA1: EnemyDef[] = [
  {
    id: "silence",
    name: { it: "Il Silenzio", en: "The Silence" },
    taunt: { it: "Shhh... qui non suona nessuno.", en: "Shhh... nobody plays here." },
    color: 0x6d7f8c,
    shape: "blob",
    hp: 60,
    bpm: 72,
    attack: 8,
    phrases: [
      ["4", "-4"],
      ["4", "4", "-4"],
      ["-4", "4", "-4"],
      ["4", "-4", "5", "-4"],
      ["5", "-4", "4", "4"],
    ],
    volleyNotes: ["4", "-4", "5"],
    volleySize: 4,
  },
  {
    id: "offkey",
    name: { it: "Lo Stonato", en: "The Off-Key" },
    taunt: { it: "Le note giuste? Sopravvalutate!", en: "Right notes? Overrated!" },
    color: 0x9a6b3c,
    shape: "spiky",
    hp: 80,
    bpm: 80,
    attack: 10,
    phrases: [
      ["4", "-4", "5"],
      ["5", "-5", "6"],
      ["6", "-5", "5", "-4"],
      ["4", "-4", "5", "-5", "6"],
      ["6", "6", "-5", "5", "-4", "4"],
    ],
    volleyNotes: ["4", "-4", "5", "-5", "6"],
    volleySize: 5,
  },
  {
    id: "metronome",
    name: { it: "Il Metronomo Impazzito", en: "The Mad Metronome" },
    taunt: { it: "Tic, tac, tic... prova a starmi dietro!", en: "Tick, tock, tick... try to keep up!" },
    color: 0xb0442b,
    shape: "clock",
    hp: 120,
    bpm: 92,
    attack: 12,
    boss: true,
    phrases: [
      ["4", "-4", "5", "-5", "6"],
      ["6", "-6", "7", "-6", "6"],
      ["4", "5", "6", "7", "6", "5"],
      ["-4", "-5", "-6", "-6", "-5", "-4"],
      ["4", "-4", "5", "-5", "6", "-6", "7"],
    ],
    volleyNotes: ["4", "-4", "5", "-5", "6", "-6", "7"],
    volleySize: 6,
  },
];

export const enemyById = (id: string) => AREA1.find((e) => e.id === id)!;
