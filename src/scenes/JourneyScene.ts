import Phaser from "phaser";
import manifest from "../assets/manifest.json";
import { AREAS, type AreaDef } from "../content/areas";
import { areaCleared, areaUnlocked, currentArea, nextEnemy } from "../progress";
import { getLang, t } from "../i18n";
import { save } from "../state";
import { getEngine } from "../audio/engine";
import { C, W, H, HEX, txt, button, paper, portrait } from "../ui";
import { HearingReadout } from "./readout";
import { showIntro } from "./lessons";
import { grooveOnGesture } from "../audio/music";
import { hop, pulse } from "./beat";

// Tre righe a serpentina: la strada va a destra, poi torna a sinistra, poi di nuovo a destra.
const COLS = [250, 640, 1030];
const ROWS = [196, 352, 508];

interface Musician {
  key: string;
  musicista: string;
  siUnisceDopo: string;
}

/** La mappa del viaggio: le tappe del percorso, una dopo l'altra. */
export class JourneyScene extends Phaser.Scene {
  private readout!: HearingReadout;

  constructor() {
    super("journey");
  }

  create(): void {
    if (portrait()) return this.createPortrait();
    const progress = { beaten: save.beaten, openAll: save.settings.openAll };
    paper(this);
    txt(this, W / 2, 62, t("journey").toUpperCase(), 46, HEX.inchiostro, "titoli").setShadow(4, 3, HEX.rosso, 0, false, true);

    const spots = AREAS.map((a, i) => {
      const row = Math.floor(i / 3);
      const col = row % 2 === 0 ? i % 3 : 2 - (i % 3);
      return { a, x: COLS[col], y: ROWS[row] };
    });

    // la strada: una striscia color sabbia con la mezzeria tratteggiata
    const road = this.add.graphics();
    const path = new Phaser.Curves.Path(spots[0].x, spots[0].y);
    for (let i = 1; i < spots.length; i++) {
      const p = spots[i - 1],
        q = spots[i];
      if (p.y === q.y) path.lineTo(q.x, q.y);
      else {
        // curva a U sul bordo
        const side = p.x > W / 2 ? 1 : -1;
        path.cubicBezierTo(q.x, q.y, p.x + side * 170, p.y, q.x + side * 170, q.y);
      }
    }
    road.lineStyle(30, C.carta2, 1);
    path.draw(road, 120);
    road.lineStyle(3, C.inchiostro, 0.35);
    const pts = path.getSpacedPoints(160);
    for (let i = 0; i < pts.length - 1; i += 2) road.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);

    const here = currentArea(progress);
    grooveOnGesture(this, here.music);
    for (const { a, x, y } of spots) this.stop(a, x, y, areaUnlocked(a, progress), !a.comingSoon && areaCleared(a, progress), a.id === here.id);

    // in basso: la band che si è unita finora
    this.add.rectangle(W / 2, H - 46, W, 92, C.carta, 0.95);
    this.add.rectangle(W / 2, H - 92, W, 3, C.inchiostro, 0.4);
    const joined = this.joined();
    txt(this, 262, H - 72, t("band").toUpperCase(), 14, HEX.inchiostro)
      .setOrigin(0, 0.5)
      .setLetterSpacing(3);
    if (joined.length === 0)
      txt(this, 330, H - 38, t("bandEmpty"), 16, HEX.inchiostro)
        .setAlpha(0.7)
        .setWordWrapWidth(300);
    joined.forEach((m, i) => {
      this.add.image(292 + i * 60, H - 34, m.key).setDisplaySize(62, 62);
    });
    this.readout = new HearingReadout(this, 1010, H - 20);
    const next = nextEnemy(progress);
    pulse(this, [button(this, 800, H - 52, `${t("play")} ▶`, () => this.scene.start("battle", { enemyId: next.id }), 240, true, 56).setName("play")]);
    button(this, 128, H - 46, t("help"), () => showIntro(this), 216, false, 48).setName("help");
    button(this, W - 110, H - 58, t("options"), () => this.scene.start("options", { from: "journey" }), 180, false, 40).setName("options");
  }

  /** I musicisti che si sono uniti: uno per ogni boss battuto. */
  private joined(): Musician[] {
    const band = (manifest.file as unknown as Musician[]).filter((f) => f.siUnisceDopo && f.key.endsWith("-suona"));
    return band.filter((m) => {
      const area = AREAS.find((a) => a.id === m.siUnisceDopo);
      const boss = area?.enemies.find((e) => e.boss);
      return boss && save.beaten.includes(boss.id);
    });
  }

  /**
   * In verticale la strada scende dall'alto in basso, con le tappe una sotto l'altra:
   * il cerchio a sinistra e il nome accanto, da leggere come una scaletta. In fondo la band e i pulsanti grandi.
   */
  private createPortrait(): void {
    const progress = { beaten: save.beaten, openAll: save.settings.openAll };
    paper(this);
    txt(this, W / 2, 66, t("journey").toUpperCase(), 44, HEX.inchiostro, "titoli")
      .setShadow(4, 3, HEX.rosso, 0, false, true)
      .setWordWrapWidth(W - 60);
    this.readout = new HearingReadout(this, W / 2, 120, HEX.inchiostro, 22);

    // spazio per le tappe tra il titolo e la barra in basso
    const barTop = H - 340;
    const top = 196;
    const step = (barTop - 60 - top) / Math.max(1, AREAS.length - 1);
    const r = Math.min(42, Math.floor(step / 2) - 6);
    // la strada fa una leggera serpentina: i cerchi vanno un po' a destra e un po' a sinistra
    const spots = AREAS.map((a, i) => ({ a, x: i % 2 === 0 ? 92 : 128, y: top + i * step }));

    const road = this.add.graphics();
    const path = new Phaser.Curves.Path(spots[0].x, spots[0].y);
    for (let i = 1; i < spots.length; i++) {
      const p = spots[i - 1],
        q = spots[i];
      path.cubicBezierTo(q.x, q.y, p.x, p.y + step / 2, q.x, q.y - step / 2);
    }
    road.lineStyle(30, C.carta2, 1);
    path.draw(road, 120);
    road.lineStyle(3, C.inchiostro, 0.35);
    const pts = path.getSpacedPoints(Math.round((barTop - top) / 9));
    for (let i = 0; i < pts.length - 1; i += 2) road.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);

    const here = currentArea(progress);
    grooveOnGesture(this, here.music);
    const lang = getLang();
    for (const { a, x, y } of spots) {
      const open = areaUnlocked(a, progress);
      const cleared = !a.comingSoon && areaCleared(a, progress);
      const current = a.id === here.id;
      // la tappa attuale ha un nastro dietro, così si trova subito
      if (current && open) {
        const g = this.add.graphics();
        g.fillStyle(C.ottone, 0.28).fillRect(24, y - step / 2 + 1, W - 48, step - 2);
        g.lineStyle(3, C.ottone, 1).strokeRect(24, y - step / 2 + 1, W - 48, step - 2);
      }
      const color = a.extra ? C.prugna : open ? C.ottone : C.carta2;
      const g = this.add.graphics();
      g.fillStyle(C.inchiostro, 1).fillCircle(x + 4, y + 4, r);
      g.fillStyle(color, 1).fillCircle(x, y, r);
      g.lineStyle(4, C.inchiostro, 1).strokeCircle(x, y, r);
      const label = a.extra ? "★" : cleared ? "✓" : String(a.order);
      txt(this, x, y + 2, label, Math.round(r * 0.8), a.extra ? HEX.carta : HEX.inchiostro, "titoli").setAlpha(open || a.extra ? 1 : 0.45);
      const tx = 186;
      const textW = W - tx - (current && open ? 110 : 40);
      const name = txt(this, tx, y, a.name[lang].toUpperCase(), step < 100 ? 24 : 26, HEX.inchiostro, "titoli")
        .setOrigin(0, 0)
        .setAlign("left")
        .setAlpha(open ? 1 : 0.5)
        .setWordWrapWidth(textW);
      const sub = a.comingSoon ? t("comingSoon") : open ? a.technique[lang] : a.extra ? t("extraLocked") : t("areaLocked");
      const subT = txt(this, tx, y + 2, sub, 21, a.comingSoon ? HEX.rosso : HEX.inchiostro)
        .setOrigin(0, 0)
        .setAlign("left")
        .setAlpha(open ? 0.85 : 0.6)
        .setWordWrapWidth(textW);
      // se il sottotitolo va su due righe e lo spazio è poco, si fa più piccolo
      if (name.height + subT.height + 4 > step - 10) subT.setFontSize(19);
      // nome e sottotitolo insieme, centrati sul cerchio
      const top = y - (name.height + 4 + subT.height) / 2;
      name.setY(top);
      subT.setY(top + name.height + 4);
      if (current && open) {
        const me = this.add.image(W - 86, y, "personaggi-protagonista-suona").setDisplaySize(Math.min(96, step), Math.min(96, step));
        hop(this, me, 8);
      }
      if (!open) continue;
      const zone = this.add
        .zone(W / 2, y, W - 40, step)
        .setInteractive({ useHandCursor: true })
        .setName(`area-${a.id}`);
      zone.on("pointerover", () => name.setColor(HEX.rosso));
      zone.on("pointerout", () => name.setColor(HEX.inchiostro));
      zone.on("pointerup", () => this.openArea(a));
    }

    // in fondo: la band, poi Gioca grande e i due pulsanti secondari
    this.add.rectangle(W / 2, barTop + (H - barTop) / 2, W, H - barTop, C.carta, 0.95);
    this.add.rectangle(W / 2, barTop, W, 3, C.inchiostro, 0.4);
    txt(this, 40, barTop + 30, t("band").toUpperCase(), 20, HEX.inchiostro)
      .setOrigin(0, 0.5)
      .setLetterSpacing(3);
    const joined = this.joined();
    if (joined.length === 0)
      txt(this, 40, barTop + 76, t("bandEmpty"), 21, HEX.inchiostro)
        .setOrigin(0, 0.5)
        .setAlign("left")
        .setAlpha(0.7)
        .setWordWrapWidth(W - 80);
    const size = Math.min(70, (W - 80) / Math.max(1, joined.length));
    joined.forEach((m, i) => {
      this.add.image(40 + size / 2 + i * size, barTop + 82, m.key).setDisplaySize(size, size);
    });
    const next = nextEnemy(progress);
    pulse(this, [button(this, W / 2, H - 160, `${t("play")} ▶`, () => this.scene.start("battle", { enemyId: next.id }), W - 80, true, 88).setName("play")]);
    const half = (W - 104) / 2;
    button(this, 40 + half / 2, H - 52, t("help"), () => showIntro(this), half, false, 72).setName("help");
    button(this, W - 40 - half / 2, H - 52, t("options"), () => this.scene.start("options", { from: "journey" }), half, false, 72).setName("options");
  }

  private stop(a: AreaDef, x: number, y: number, open: boolean, cleared: boolean, current: boolean): void {
    const lang = getLang();
    const color = a.extra ? C.prugna : open ? C.ottone : C.carta2;
    const g = this.add.graphics();
    g.fillStyle(C.inchiostro, 1).fillCircle(x + 4, y + 4, 42);
    g.fillStyle(color, 1).fillCircle(x, y, 42);
    g.lineStyle(4, C.inchiostro, 1).strokeCircle(x, y, 42);
    const label = a.extra ? "★" : cleared ? "✓" : String(a.order);
    txt(this, x, y + 2, label, 34, a.extra ? HEX.carta : HEX.inchiostro, "titoli").setAlpha(open || a.extra ? 1 : 0.45);
    const name = txt(this, x, y + 62, a.name[lang].toUpperCase(), 19, HEX.inchiostro, "titoli").setAlpha(open ? 1 : 0.5);
    const sub = a.comingSoon ? t("comingSoon") : open ? a.technique[lang] : a.extra ? t("extraLocked") : t("areaLocked");
    // sotto il nome, dall'alto: su due righe scende senza coprirlo
    txt(this, x, y + 76, sub, 16, a.comingSoon ? HEX.rosso : HEX.inchiostro)
      .setOrigin(0.5, 0)
      .setAlpha(open ? 0.85 : 0.6)
      .setWordWrapWidth(330);
    if (current && open) {
      const me = this.add.image(x - 62, y - 30, "personaggi-protagonista-suona").setDisplaySize(84, 84);
      hop(this, me, 8);
    }
    if (!open) return;
    const zone = this.add
      .zone(x, y + 30, 260, 150)
      .setInteractive({ useHandCursor: true })
      .setName(`area-${a.id}`);
    zone.on("pointerover", () => name.setColor(HEX.rosso));
    zone.on("pointerout", () => name.setColor(HEX.inchiostro));
    zone.on("pointerup", () => this.openArea(a));
  }

  /** Dritti alla tappa: le lezioni di Zia Mae restano a portata di tasto, senza fermare il gioco. */
  private openArea(a: AreaDef): void {
    this.scene.start("map", { areaId: a.id });
  }

  update(): void {
    getEngine().poll();
    this.readout.update();
  }
}
