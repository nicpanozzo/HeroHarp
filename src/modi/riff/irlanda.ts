// Copiato da modes/src/riff/irlanda.ts con scripts/sync-content.mjs, non modificare qui.
// I brani irlandesi della Strada dei Riff: musica tradizionale, presa da raccolte di pubblico dominio
// (Francis O'Neill, "Music of Ireland" 1903 e "Dance Music of Ireland" 1907; Ryan's Mammoth Collection 1883)
// e da The Session per The Kesh. Le melodie restano scritte in ABC come nelle fonti, senza ripetizioni
// e senza abbellimenti; dove la fonte chiede una nota che sull'armonica serve un bend, è segnato qui accanto.
//
// Il trasporto porta ogni brano dove l'armonica diatonica lo suona senza bend:
// - brani in Sol maggiore: +5 → Do, prima posizione, fori 3-8;
// - brani in Re maggiore: +10 → Do acuto, prima posizione, fori 4-10 (in basso mancherebbero La e Fa);
// - brani in Mi dorico: +10 → Re dorico, terza posizione, fori 4-9.
// Con un'armonica in Sol (quella delle sessioni irlandesi) la stessa intavolatura suona in Sol.

export type TipoBrano = "giga" | "reel" | "polka" | "aria" | "marcia";

export interface Brano {
  id: string;
  nome: string;
  descr: { it: string; en: string };
  tipo: TipoBrano;
  livello: 1 | 2 | 3 | 4 | 5;
  /** Battiti al minuto: per le gighe il battito è la semiminima puntata (tre crome). */
  bpm: number;
  posizione: 1 | 2 | 3;
  swing: "shuffle" | "dritto";
  fonte: string;
  abc: { tonalita: string; unita: string; battito: string; semitoni: number; musica: string };
}

export const NOMI_TIPO: Record<TipoBrano, { it: string; en: string }> = {
  giga: { it: "Giga", en: "Jig" },
  reel: { it: "Reel", en: "Reel" },
  polka: { it: "Polka", en: "Polka" },
  aria: { it: "Aria lenta", en: "Slow air" },
  marcia: { it: "Marcia", en: "March" },
};

export const BRANI: Brano[] = [
  {
    id: "minstrel-boy", nome: "The Minstrel Boy", tipo: "marcia", livello: 1, bpm: 80, posizione: 1, swing: "dritto",
    descr: { it: "Note lunghe e passo tranquillo: si comincia da qui.", en: "Long notes at an easy pace: start here." },
    fonte: "O'Neill's Music of Ireland, n. 203",
    // ^d (Sol diesis sull'armonica) diventa d: sull'armonica in Do non c'è
    abc: { tonalita: "G", unita: "1/8", battito: "1/4", semitoni: 5, musica:
      "G3A cBAG | B2d2 g2fg | e2d2 Bcd>B | A4 G3 d | g2f2 e2fg | f2e2 d4 | e3B B2d2 | e2f2 g4 |" +
      "G3A cBAG | B2d2 g2fg | e2d2 Bcd>B | A4 G4 |" },
  },
  {
    id: "rakes-of-mallow", nome: "The Rakes of Mallow", tipo: "polka", livello: 2, bpm: 76, posizione: 1, swing: "dritto",
    descr: { it: "Polka saltellante del Settecento.", en: "A bouncy 18th-century polka." },
    fonte: "O'Neill's Music of Ireland, n. 1814",
    abc: { tonalita: "G", unita: "1/16", battito: "1/4", semitoni: 5, musica:
      "G2B2 G2B2 | G2B2 cBAG | F2A2 F2A2 | F2A2 dcBA | G2B2 G2B2 | G2B2 d2B2 | cBAG FGAc | B2G2 G2z2 |" +
      "g2fe d2c2 | B2c2 d2B2 | g2fe d2c2 | B2e2 A2z2 | g2fe d2c2 | B2c2 d2B2 | cBAG FGAc | B2G2 G4 |" },
  },
  {
    id: "dawning-of-the-day", nome: "The Dawning of the Day", tipo: "aria", livello: 2, bpm: 72, posizione: 1, swing: "dritto",
    descr: { it: "Fáinne Geal an Lae: aria lenta, tutta in alto.", en: "Fáinne Geal an Lae: a slow air, up high." },
    fonte: "O'Neill's Music of Ireland, n. 108",
    abc: { tonalita: "D", unita: "1/8", battito: "1/4", semitoni: 10, musica:
      "d2 d>e f>gef | d>fed c2 z d | A>BG>A F>GEF | Ddec d2 z f/g/ |" +
      "affa ag z g | affa g3 f | egec egec | z ffe f3g | afga bagf | efed c2 z d | A>BG>A F>GEF | Ddec d4 |" },
  },
  {
    id: "irish-washerwoman", nome: "The Irish Washerwoman", tipo: "giga", livello: 3, bpm: 80, posizione: 1, swing: "shuffle",
    descr: { it: "La giga più famosa: tre note per battito.", en: "The most famous jig: three notes per beat." },
    fonte: "Ryan's Mammoth Collection (1883)",
    abc: { tonalita: "G", unita: "1/8", battito: "3/8", semitoni: 5, musica:
      "BGG DGG | BGB dcB | cAA DAA | cAc edc | BGG DGG | BGB dcB | cBc Adc | BGG G2 g/a/ |" +
      "bgg dgg | bgb bag | aff dff | fdf agf | egg dgg | cgg Bgg | dcB Adc | BGG G3 |" },
  },
  {
    id: "kesh", nome: "The Kesh", tipo: "giga", livello: 3, bpm: 84, posizione: 1, swing: "shuffle",
    descr: { it: "La prima giga che si impara nelle sessioni.", en: "The first jig everyone learns at sessions." },
    fonte: "The Session (thesession.org), versione 1",
    // d^cd diventa dcd: il Fa diesis acuto sull'armonica in Do non c'è
    abc: { tonalita: "G", unita: "1/8", battito: "3/8", semitoni: 5, musica:
      "G3 GAB | A3 ABd | edd gdd | edB dBA | GAG GAB | ABA ABd | edd gdd | BAF G3 |" +
      "B2B d2d | ege dBA | B2B dBG | ABA AGA | BAB dcd | ege dBd | gfg aga | bgg g3 |" },
  },
  {
    id: "drowsy-maggie", nome: "Drowsy Maggie", tipo: "reel", livello: 4, bpm: 88, posizione: 3, swing: "dritto",
    descr: { it: "Reel in terza posizione: il suono più irlandese.", en: "A third-position reel: the most Irish sound." },
    fonte: "O'Neill's Dance Music of Ireland, n. 1425",
    abc: { tonalita: "Edor", unita: "1/8", battito: "1/4", semitoni: 10, musica:
      "E2BE dEBE | E2BE AFDF | E2BE dEBE | BABc dAFD | E2BE dEBE | E2BE AFDF | E2BE dEBE | BABc dAFA |" +
      "d2fd c2ec | defg afge | d2fd c2ec | BABc dAFA | d2fd c2ec | defg afge | afge fdec | BABc dAFD |" },
  },
  {
    id: "haste-to-the-wedding", nome: "Haste to the Wedding", tipo: "giga", livello: 4, bpm: 80, posizione: 1, swing: "shuffle",
    descr: { it: "Giga da matrimonio, con salti d'ottava.", en: "A wedding jig with octave leaps." },
    fonte: "Ryan's Mammoth Collection (1883)",
    abc: { tonalita: "D", unita: "1/8", battito: "3/8", semitoni: 10, musica:
      "AFG Agf | ede fdB | AFA AdF | EFE E2 F/G/ | AFG Aaf | ede fdB | AFA faf | ddd d2 f/g/ |" +
      "afa afa | bgb bag | fga agf | efe efg | a3 f3 | ede fdB | AFA faf | ddd d3 |" },
  },
  {
    id: "merry-blacksmith", nome: "The Merry Blacksmith", tipo: "reel", livello: 5, bpm: 92, posizione: 1, swing: "dritto",
    descr: { it: "Reel di corsa: il martello del fabbro.", en: "A racing reel: the blacksmith's hammer." },
    fonte: "O'Neill's Dance Music of Ireland, n. 1509",
    abc: { tonalita: "D", unita: "1/8", battito: "1/4", semitoni: 10, musica:
      "d3A BAFA | ABdA BAFA | ABde fded | Beed egfe | d2dA BAFA | ABdA BAFA | ABde fdec | dBAF D2 fg |" +
      "a3g f2fe | d2dA BAFA | ABde fded | Beed egfe | abag f2fe | d3A BAFA | ABde fdec | dBAF D4 |" },
  },
];
