// La Lunga Notte: pezzi di interfaccia comuni (testi, base della band, intestazione, carte).
import Phaser from "phaser";
import { getLang } from "../i18n";
import { save } from "../state";
import { getEngine } from "../audio/engine";
import { hush } from "../audio/music";
import { PRESET, type TonalitaArmonica } from "../style/basi";
import { C, HEX, W, txt, panel } from "../ui";
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

export function hud(scene: Phaser.Scene, run: RunState, opts: { hp?: boolean } = {}): void {
  const area = areaOf(run);
  panel(scene, 24, 14, W - 48, 76);
  txt(scene, 44, 36, `${s("act", { n: run.act + 1 })} · ${l(area.name)}`.toUpperCase(), 20, HEX.inchiostro, "titoli").setOrigin(0, 0.5);
  const tech = txt(scene, 44, 66, `${s("technique")}: ${l(area.technique)}`, 16, HEX.indaco).setOrigin(0, 0.5);
  // la tecnica resta sulla sua riga, accorciata se non ci sta
  while (tech.width > 480 && tech.text.length > 10) tech.setText(tech.text.slice(0, -2).trimEnd() + "…");
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
