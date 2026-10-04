// La Lunga Notte: pezzi di interfaccia comuni (testi, base della band, intestazione, carte).
import Phaser from "phaser";
import { getLang } from "../i18n";
import { save } from "../state";
import { getEngine } from "../audio/engine";
import { hush } from "../audio/music";
import { PRESET, type TonalitaArmonica } from "../style/basi";
import { C, HEX, W, txt, panel, portrait, button } from "../ui";
import { S, GROOVES, gearById, musicianById, type GearId, type StringKey } from "./data";
import { areaOf, bandInstruments, type Offer, type RunState } from "./run";
import type { L10n } from "../content/areas";

/** Testo nella lingua del gioco, con segnaposto {n}, {name}… */
export function s(key: StringKey, vars: Record<string, string | number> = {}): string {
  return l(S[key]).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
export const l = (x: L10n): string => x[getLang()];

// ---------- la base: suona la tua band ----------

let playing: string | null = null;

/** Fa suonare la base della tappa con gli strumenti della tua band e il groove scelto. */
export function runGroove(run: RunState, bpm?: number): void {
  const engine = getEngine();
  if (engine.ctx.state !== "running") return;
  const area = areaOf(run);
  const b = engine.basi;
  const sig = `${area.music}|${save.keyId}|${run.groove}`;
  if (b.inRiproduzione && playing === sig) {
    // stessa tappa: la band cambia al volo (chi si unisce entra alla croma dopo)
    b.impostaBand(bandInstruments(run));
    if (bpm && b.bpm !== bpm) b.impostaTempo(bpm);
    return;
  }
  b.avvia({
    area: area.music,
    armonica: save.keyId as TonalitaArmonica,
    band: bandInstruments(run),
    swing: run.groove,
    bpm: bpm ?? PRESET[area.music].bpm,
  });
  playing = sig;
  engine.fx.tonica = b.tonicaMidi;
  engine.fx.minore = b.minore;
}

/** Il primo tocco della scena accende l'audio (serve un gesto) e la band. */
export function runGrooveOnGesture(scene: Phaser.Scene, run: RunState): void {
  runGroove(run);
  const go = async () => {
    await getEngine().resume();
    runGroove(run);
  };
  scene.input.once("pointerdown", go);
  scene.input.keyboard?.once("keydown", go);
}

/** Uscendo dalla notte la base si ferma: la riprende il resto del gioco con la sua musica. */
export function leaveRun(scene: Phaser.Scene, to: string, data?: object): void {
  hush();
  playing = null;
  scene.scene.start(to, data);
}

// ---------- intestazione: atto, vita, dollari, band ----------

/** Dove finisce l'intestazione (ombra compresa): sotto si può disegnare. In orizzontale 96, in verticale 186 (96 senza vita). */
export const hudBottom = (opts: { hp?: boolean } = {}): number => (portrait() ? (opts.hp === false ? 96 : 186) : 96);

/** Accorcia un testo con i puntini finché non sta nella larghezza data. */
function fit(t: Phaser.GameObjects.Text, width: number): Phaser.GameObjects.Text {
  while (t.width > width && t.text.length > 10) t.setText(t.text.slice(0, -2).trimEnd() + "…");
  return t;
}

export function hud(scene: Phaser.Scene, run: RunState, opts: { hp?: boolean } = {}): void {
  if (portrait()) return hudPortrait(scene, run, opts);
  const area = areaOf(run);
  panel(scene, 24, 14, W - 48, 76);
  txt(scene, 44, 36, `${s("act", { n: run.act + 1 })} · ${l(area.name)}`.toUpperCase(), 20, HEX.inchiostro, "titoli").setOrigin(0, 0.5);
  const tech = txt(scene, 44, 66, `${s("technique")}: ${l(area.technique)}`, 16, HEX.indaco).setOrigin(0, 0.5);
  // la tecnica resta sulla sua riga, accorciata se non ci sta
  fit(tech, 480);
  if (opts.hp !== false) {
    // vita
    const g = scene.add.graphics();
    const x = 560;
    const w = 260;
    g.fillStyle(C.carta2, 1).fillRect(x, 28, w, 22);
    g.fillStyle(C.rosso, 1).fillRect(x, 28, (w * Math.max(0, run.hp)) / run.maxHp, 22);
    g.lineStyle(3, C.inchiostro, 1).strokeRect(x, 28, w, 22);
    scene.add.image(x - 22, 39, "ui-cuore").setDisplaySize(30, 30);
    txt(scene, x + w / 2, 39, `${run.hp} / ${run.maxHp}`, 16, HEX.inchiostro, "fori")
      .setStroke(HEX.carta, 4)
      .setName("hp");
    // dollari
    txt(scene, x + w + 30, 39, `$ ${run.coins}`, 26, HEX.inchiostro, "fori")
      .setOrigin(0, 0.5)
      .setName("coins");
    txt(
      scene,
      x,
      70,
      `${l(GROOVES[run.groove].name)} · ${s("band")}: ${run.band.length ? run.band.map((id) => musicianById(id).name).join(", ") : s("footOnly")}`,
      15,
      HEX.inchiostro,
    )
      .setOrigin(0, 0.5)
      .setAlpha(0.85);
  }
}

/**
 * Intestazione in verticale: tutta la larghezza, su quattro righe (atto e tappa, tecnica, vita e dollari, groove e band).
 * Occupa y 14–180 (ombra fino a 186); senza vita solo le prime due righe, y 14–90.
 */
function hudPortrait(scene: Phaser.Scene, run: RunState, opts: { hp?: boolean }): void {
  const area = areaOf(run);
  const x = 16;
  const w = W - 32;
  const hp = opts.hp !== false;
  panel(scene, x, 14, w, hp ? 166 : 76);
  fit(txt(scene, x + 20, 38, `${s("act", { n: run.act + 1 })} · ${l(area.name)}`.toUpperCase(), 24, HEX.inchiostro, "titoli").setOrigin(0, 0.5), w - 40);
  fit(txt(scene, x + 20, 70, `${s("technique")}: ${l(area.technique)}`, 19, HEX.indaco).setOrigin(0, 0.5), w - 40);
  if (!hp) return;
  // vita: barra larga col cuore a sinistra, dollari grandi a destra
  const g = scene.add.graphics();
  const bx = x + 64;
  const bw = 360;
  g.fillStyle(C.carta2, 1).fillRect(bx, 96, bw, 30);
  g.fillStyle(C.rosso, 1).fillRect(bx, 96, (bw * Math.max(0, run.hp)) / run.maxHp, 30);
  g.lineStyle(3, C.inchiostro, 1).strokeRect(bx, 96, bw, 30);
  scene.add.image(x + 34, 111, "ui-cuore").setDisplaySize(40, 40);
  txt(scene, bx + bw / 2, 111, `${run.hp} / ${run.maxHp}`, 21, HEX.inchiostro, "fori")
    .setStroke(HEX.carta, 5)
    .setName("hp");
  txt(scene, x + w - 20, 111, `$ ${run.coins}`, 34, HEX.inchiostro, "fori")
    .setOrigin(1, 0.5)
    .setName("coins");
  const band = run.band.length ? run.band.map((id) => musicianById(id).name).join(", ") : s("footOnly");
  fit(
    txt(scene, x + 20, 154, `${l(GROOVES[run.groove].name)} · ${s("band")}: ${band}`, 19, HEX.inchiostro)
      .setOrigin(0, 0.5)
      .setAlpha(0.85),
    w - 40,
  );
}

// ---------- icone degli attrezzi (disegnate, nello stile dei manifesti) ----------

export function gearIcon(scene: Phaser.Scene, id: GearId, x: number, y: number, size = 96): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const k = size / 96;
  const ink = C.inchiostro;
  const disc = (col: number) => {
    g.fillStyle(ink, 1).fillCircle(4 * k, 4 * k, 46 * k);
    g.fillStyle(col, 1).fillCircle(0, 0, 46 * k);
    g.lineStyle(3, ink, 1).strokeCircle(0, 0, 46 * k);
  };
  disc(id === "diavolo" ? C.rosso : C.carta2);
  g.lineStyle(4 * k, ink, 1);
  switch (id) {
    case "bullet": // microfono a proiettile
      g.fillStyle(0x9aa0a6, 1).fillRoundedRect(-18 * k, -26 * k, 36 * k, 44 * k, 16 * k);
      g.strokeRoundedRect(-18 * k, -26 * k, 36 * k, 44 * k, 16 * k);
      for (let i = 0; i < 3; i++) g.lineBetween(-12 * k, (-14 + i * 10) * k, 12 * k, (-14 + i * 10) * k);
      g.lineBetween(0, 18 * k, 0, 32 * k);
      break;
    case "custodia": // valigetta
      g.fillStyle(0x8a5a2b, 1).fillRoundedRect(-30 * k, -12 * k, 60 * k, 36 * k, 6 * k);
      g.strokeRoundedRect(-30 * k, -12 * k, 60 * k, 36 * k, 6 * k);
      g.strokeRoundedRect(-10 * k, -22 * k, 20 * k, 12 * k, 4 * k);
      g.fillStyle(C.ottone, 1).fillRect(-4 * k, 0, 8 * k, 8 * k);
      break;
    case "fazzoletto":
      g.fillStyle(C.rosso, 1).fillRect(-26 * k, -26 * k, 52 * k, 52 * k);
      g.strokeRect(-26 * k, -26 * k, 52 * k, 52 * k);
      g.fillStyle(C.carta, 1);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) g.fillCircle(i * 15 * k, j * 15 * k, 4 * k);
      break;
    case "metronomo":
      g.fillStyle(0x8a5a2b, 1).fillTriangle(0, -30 * k, -24 * k, 28 * k, 24 * k, 28 * k);
      g.strokeTriangle(0, -30 * k, -24 * k, 28 * k, 24 * k, 28 * k);
      g.lineStyle(4 * k, C.ottone, 1).lineBetween(0, 22 * k, 12 * k, -18 * k);
      break;
    case "ferro":
      g.lineStyle(12 * k, 0x9aa0a6, 1)
        .beginPath()
        .arc(0, -2 * k, 24 * k, Math.PI * 0.85, Math.PI * 2.15, false)
        .strokePath();
      g.lineStyle(3 * k, ink, 1)
        .beginPath()
        .arc(0, -2 * k, 30 * k, Math.PI * 0.85, Math.PI * 2.15, false)
        .strokePath();
      break;
    case "scorta":
    case "ancia":
    case "diavolo": {
      // un'armonica vista di fronte, con i fori
      g.fillStyle(id === "diavolo" ? C.inchiostro : 0xc9ccd1, 1).fillRoundedRect(-34 * k, -14 * k, 68 * k, 28 * k, 6 * k);
      g.lineStyle(3 * k, ink, 1).strokeRoundedRect(-34 * k, -14 * k, 68 * k, 28 * k, 6 * k);
      g.fillStyle(id === "diavolo" ? C.rosso : ink, 1);
      for (let i = 0; i < 6; i++) g.fillRect((-28 + i * 10) * k, -4 * k, 6 * k, 8 * k);
      if (id === "scorta") {
        g.fillStyle(C.ottone, 1).fillCircle(24 * k, -22 * k, 11 * k);
        g.lineStyle(3 * k, ink, 1).strokeCircle(24 * k, -22 * k, 11 * k);
      }
      if (id === "ancia") g.lineStyle(4 * k, C.ottone, 1).lineBetween(-30 * k, 26 * k, 30 * k, 26 * k);
      break;
    }
    case "cappello":
      g.fillStyle(ink, 1).fillEllipse(0, 14 * k, 72 * k, 18 * k);
      g.fillRoundedRect(-20 * k, -24 * k, 40 * k, 38 * k, 6 * k);
      g.fillStyle(C.rosso, 1).fillRect(-20 * k, 4 * k, 40 * k, 7 * k);
      break;
  }
  return scene.add.container(x, y, [g]);
}

// ---------- carte delle offerte (ricompense e negozio) ----------

export const offerName = (o: Offer): string =>
  o.type === "musician" ? musicianById(o.id).name : o.type === "gear" ? l(gearById(o.id).name) : s("heal", { n: o.amount });

export const offerPerk = (o: Offer): string =>
  o.type === "musician" ? l(musicianById(o.id).perk) : o.type === "gear" ? l(gearById(o.id).perk) : s("healHint");

/** Carta di un'offerta: immagine grande, nome, a cosa serve. Restituisce il contenitore cliccabile. */
export function offerCard(scene: Phaser.Scene, o: Offer, x: number, y: number, onPick: () => void, w = 290, h = 330): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const fill = o.type === "musician" ? 0xf6d9a0 : o.type === "heal" ? 0xf3cfc6 : C.carta;
  const draw = (hover: boolean) => {
    g.clear();
    g.fillStyle(C.inchiostro, 1).fillRect(-w / 2 + 6, -h / 2 + 6, w, h);
    g.fillStyle(hover ? 0xfff1d0 : fill, 1).fillRect(-w / 2, -h / 2, w, h);
    g.lineStyle(hover ? 5 : 3, C.inchiostro, 1).strokeRect(-w / 2, -h / 2, w, h);
  };
  draw(false);
  const parts: Phaser.GameObjects.GameObject[] = [g];
  const tag = o.type === "musician" ? l(musicianById(o.id).role).toUpperCase() : o.type === "gear" ? s("gear").toUpperCase() : "";
  if (tag)
    parts.push(
      txt(scene, 0, -h / 2 + 20, tag, 14, HEX.inchiostro)
        .setLetterSpacing(2)
        .setAlpha(0.75),
    );
  if (o.type === "musician") parts.push(scene.add.image(0, -50, `band-${o.id}-saluta`).setDisplaySize(170, 170));
  else if (o.type === "gear") parts.push(gearIcon(scene, o.id, 0, -50, 130));
  else parts.push(scene.add.image(0, -50, "ui-cuore").setDisplaySize(120, 120));
  parts.push(txt(scene, 0, 56, offerName(o).toUpperCase(), 24, HEX.inchiostro, "titoli").setWordWrapWidth(w - 24));
  parts.push(
    txt(scene, 0, 108, offerPerk(o), 18, HEX.inchiostro)
      .setWordWrapWidth(w - 30)
      .setOrigin(0.5, 0.5),
  );
  const c = scene.add.container(x, y, parts).setSize(w, h).setInteractive({ useHandCursor: true });
  c.on("pointerover", () => draw(true));
  c.on("pointerout", () => draw(false));
  c.on("pointerup", onPick);
  return c;
}

/**
 * Offerta in verticale: una carta larga quanto lo schermo, immagine a sinistra e testo a destra.
 * `aside` lascia libera una colonna a destra (per il prezzo nel negozio).
 */
export function offerRow(
  scene: Phaser.Scene,
  o: Offer,
  x: number,
  y: number,
  onPick: () => void,
  w: number,
  h: number,
  aside = 0,
): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const fill = o.type === "musician" ? 0xf6d9a0 : o.type === "heal" ? 0xf3cfc6 : C.carta;
  const draw = (hover: boolean) => {
    g.clear();
    g.fillStyle(C.inchiostro, 1).fillRect(-w / 2 + 6, -h / 2 + 6, w, h);
    g.fillStyle(hover ? 0xfff1d0 : fill, 1).fillRect(-w / 2, -h / 2, w, h);
    g.lineStyle(hover ? 5 : 3, C.inchiostro, 1).strokeRect(-w / 2, -h / 2, w, h);
  };
  draw(false);
  const parts: Phaser.GameObjects.GameObject[] = [g];
  const pic = Math.min(h - 24, 170);
  const px = -w / 2 + 16 + pic / 2;
  if (o.type === "musician") parts.push(scene.add.image(px, 0, `band-${o.id}-saluta`).setDisplaySize(pic * 1.1, pic * 1.1));
  else if (o.type === "gear") parts.push(gearIcon(scene, o.id, px, 0, pic * 0.85));
  else parts.push(scene.add.image(px, 0, "ui-cuore").setDisplaySize(pic * 0.75, pic * 0.75));
  // colonna del testo: dal bordo dell'immagine al bordo destro (meno lo spazio lasciato a parte)
  const tx0 = -w / 2 + 32 + pic;
  const tw = w / 2 - aside - 18 - tx0;
  const cx = tx0 + tw / 2;
  const tag = o.type === "musician" ? l(musicianById(o.id).role).toUpperCase() : o.type === "gear" ? s("gear").toUpperCase() : "";
  const col: Phaser.GameObjects.Text[] = [];
  if (tag) col.push(txt(scene, cx, 0, tag, 17, HEX.inchiostro).setLetterSpacing(2).setAlpha(0.75));
  col.push(txt(scene, cx, 0, offerName(o).toUpperCase(), 28, HEX.inchiostro, "titoli").setWordWrapWidth(tw));
  const perk = txt(scene, cx, 0, offerPerk(o), 22, HEX.inchiostro).setWordWrapWidth(tw);
  col.push(perk);
  // se la carta è bassa la descrizione si stringe un po'
  const total = () => col.reduce((a, t) => a + t.height, 0) + (col.length - 1) * 8;
  if (total() > h - 20) perk.setFontSize(19);
  let yy = -total() / 2;
  for (const t of col) {
    t.setY(yy + t.height / 2);
    yy += t.height + 8;
  }
  parts.push(...col);
  const c = scene.add.container(x, y, parts).setSize(w, h).setInteractive({ useHandCursor: true });
  c.on("pointerover", () => draw(true));
  c.on("pointerout", () => draw(false));
  c.on("pointerup", onPick);
  return c;
}

// ---------- impaginazione in verticale ----------

/** Pulsante da telefono: lo stesso di sempre, alto almeno 70, con la scritta più grande (che non esce mai dai bordi). */
export function bigButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  w: number,
  primary = true,
  h = 88,
): Phaser.GameObjects.Container {
  const b = button(scene, x, y, label, onClick, w, primary, Math.max(70, h));
  const t = b.list[1] as Phaser.GameObjects.Text;
  t.setFontSize(h >= 84 ? 30 : 26);
  if (t.width > w - 36) t.setScale((w - 36) / t.width);
  return b;
}

/** Un pezzo della colonna: quanto è alto e dove metterlo, dato il suo centro. */
export type Slot = { h: number; at: (y: number) => void };
/** Un pezzo fatto di un solo oggetto centrato sul suo y (testi, pulsanti, immagini). */
export const slot = (o: { setY(y: number): unknown }, h: number): Slot => ({ h, at: (y) => o.setY(y) });

/**
 * Impila i pezzi dall'alto in basso tra `top` e `bottom`, distribuendo lo spazio che avanza tra uno e l'altro
 * (al massimo `maxGap`; il resto va sopra e sotto in parti uguali). Così la pagina riempie lo schermo da H 1180 a 1560.
 */
export function spread(slots: Slot[], top: number, bottom: number, maxGap = 70, minGap = 10): void {
  const used = slots.reduce((a, x) => a + x.h, 0);
  const gap = Phaser.Math.Clamp((bottom - top - used) / Math.max(1, slots.length - 1), minGap, maxGap);
  let y = top + Math.max(0, (bottom - top - used - gap * (slots.length - 1)) / 2);
  for (const x of slots) {
    x.at(y + x.h / 2);
    y += x.h + gap;
  }
}
