import Phaser from "phaser";
import manifest from "../assets/manifest.json";
import { AREAS, type AreaDef } from "../content/areas";
import { areaCleared, areaUnlocked, currentArea, nextEnemy } from "../progress";
import { getLang, t } from "../i18n";
import { save } from "../state";
import { getEngine } from "../audio/engine";
import { C, W, H, HEX, txt, button, paper } from "../ui";
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
    const band = (manifest.file as unknown as Musician[]).filter((f) => f.siUnisceDopo && f.key.endsWith("-suona"));
    const joined = band.filter((m) => {
      const area = AREAS.find((a) => a.id === m.siUnisceDopo);
      const boss = area?.enemies.find((e) => e.boss);
      return boss && save.beaten.includes(boss.id);
    });
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
