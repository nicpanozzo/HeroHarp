import Phaser from "phaser";
import { Battle, PLAYER_HP, type BattleEvent, type Round } from "../battle/logic";
import { areaById, enemyById, type EnemyDef } from "../content/areas";
import { keyById, noteName, type Tab } from "../harp";
import type { PhraseNote } from "../battle/logic";
import { getLang, t } from "../i18n";
import { save, persist } from "../state";
import { getEngine } from "../audio/engine";
import type { TonalitaArmonica } from "../style/basi";
import { C, W, H, HEX, txt, backdrop, pop, panel, button, reducedMotion } from "../ui";
import { HearingReadout } from "./readout";
import { applySettings } from "../settings";

// Pannello di battaglia (in basso): corsie verticali, una per foro, come nella guida di stile.
const BOARD = { x: 300, y: 430, w: 680, h: 270 };
const LANE_TOP = BOARD.y + 14;
const HIT_Y = BOARD.y + BOARD.h - 62;
/** Battiti che un colpo impiega a scendere fino alla linea. */
const TRAVEL_BEATS = 3;
const PLAYER = { x: 175, y: 470 };
const ENEMY = { x: 1110, y: 440 };

interface Chip {
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  x: number;
  tab: Tab;
}

/** Etichetta di una nota della frase: 4↑, 4↓', accordo 456↑, overblow 6↑°. */
export function chipLabel(n: PhraseNote): string {
  const src = n.source;
  const arrow = n.tab.draw ? "↓" : "↑";
  if (src.kind === "chord" && src.holes.length > 1) return `${src.holes.join("")}${arrow}`;
  const over = src.technique === "overblow" || src.technique === "overdraw" ? "°" : "";
  return `${n.tab.hole}${arrow}${"'".repeat(n.tab.bend)}${over}`;
}

type Pose = "idle" | "suona" | "colpito" | "vittoria";
type EnemyPose = "idle" | "attacco" | "colpito" | "sconfitto";

export class BattleScene extends Phaser.Scene {
  private battle!: Battle;
  private enemy!: EnemyDef;
  private enemyImg!: Phaser.GameObjects.Image;
  private playerImg!: Phaser.GameObjects.Image;
  private banner!: Phaser.GameObjects.Text;
  private sub!: Phaser.GameObjects.Text;
  private beatDot!: Phaser.GameObjects.Arc;
  private hp!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private streakText!: Phaser.GameObjects.Text;
  private shownScore = 0;
  private flash!: Phaser.GameObjects.Rectangle;
  private chips: Chip[] = [];
  private chipLayer!: Phaser.GameObjects.Container;
  private projectiles = new Map<number, Phaser.GameObjects.Container>();
  private laneG!: Phaser.GameObjects.Graphics;
  private laneLabels?: Phaser.GameObjects.Text[];
  private readout!: HearingReadout;
  private scheduledRound = 0;
  private beatTimes: number[] = [];
  private cleanup: (() => void)[] = [];
  private ending = false;
  private playerTurn = false;
  private poseUntil = 0;
  private enemyPoseUntil = 0;

  constructor() {
    super("battle");
  }

  init(data: { enemyId: string }): void {
    this.enemy = enemyById(data.enemyId);
    this.chips = [];
    this.projectiles.clear();
    this.laneLabels = undefined;
    this.scheduledRound = 0;
    this.beatTimes = [];
    this.cleanup = [];
    this.ending = false;
    this.shownScore = 0;
    this.playerTurn = false;
    this.poseUntil = this.enemyPoseUntil = 0;
  }

  create(): void {
    const engine = getEngine();
    const lang = getLang();
    applySettings();
    const area = areaById(this.enemy.areaId);
    backdrop(this, area.backdrop);

    // base musicale nella tonalità dell'armonica: i round partono sempre a inizio battuta
    const basi = engine.basi;
    const align = (at: number) => {
      let s = basi.prossimaBattuta();
      while (s < at - 0.01) s += basi.durataBattuta;
      return s;
    };
    this.battle = new Battle(this.enemy, keyById(save.keyId), { align });
    basi.avvia({ area: area.music, armonica: save.keyId as TonalitaArmonica, bpm: this.battle.bpm });
    engine.fx.tonica = basi.tonicaMidi;
    this.cleanup.push(() => basi.ferma(0.4));
    this.cleanup.push(
      basi.suBattito((n, tm) => {
        this.beatTimes.push(tm);
        // a base spenta il tempo lo tiene il metronomo
        const st = save.settings;
        if (st.metronome && (this.playerTurn || !st.music)) engine.click(tm, n === 0);
      }),
    );
    engine.duckBand(false);

    // intestazione: vita del nemico a sinistra, la tua a destra (come nel mockup della guida)
    panel(this, 24, 16, W - 48, 74);
    this.hp = this.add.graphics();
    const k = keyById(save.keyId);
    txt(this, 44, 38, this.enemy.name[lang].toUpperCase(), 18, HEX.rosso).setOrigin(0, 0.5).setLetterSpacing(2);
    txt(this, W - 44, 38, `${t("you").toUpperCase()} · ${t("harpIn").toUpperCase()} ${(lang === "it" ? k.it : k.en).toUpperCase()}`, 18, HEX.ottone)
      .setOrigin(1, 0.5)
      .setLetterSpacing(2);

    // punteggio al centro dell'intestazione, serie di colpi sotto
    this.scoreText = txt(this, W / 2, 53, "0", 34, HEX.inchiostro, "fori").setName("score");
    this.streakText = txt(this, W / 2, 112, "", 26, HEX.ottone, "titoli")
      .setStroke(HEX.inchiostro, 6)
      .setAlpha(0);
    button(this, 70, 122, "‹", () => this.scene.start("map", { areaId: this.enemy.areaId }), 64, false, 44).setName("exit");
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("map", { areaId: this.enemy.areaId }));
    this.flash = this.add.rectangle(W / 2, H / 2, W, H, C.rosso, 0).setDepth(30);
    if (!this.textures.exists("dot")) {
      const g = this.make.graphics({}, false);
      g.fillStyle(0xffffff, 1).fillCircle(6, 6, 6);
      g.generateTexture("dot", 12, 12);
      g.destroy();
    }

    this.banner = txt(this, W / 2, 158, "", 46, HEX.inchiostro, "titoli")
      .setStroke(HEX.carta, 8)
      .setName("banner");
    this.sub = txt(this, W / 2, 200, "", 19, HEX.inchiostro).setStroke(HEX.carta, 5);
    this.beatDot = this.add.circle(W / 2, 226, 8, C.rosso).setAlpha(0.25);

    this.playerImg = this.add.image(PLAYER.x, PLAYER.y, "personaggi-protagonista-idle").setDisplaySize(250, 250);
    const size = this.enemy.boss ? 330 : 260;
    this.enemyImg = this.add.image(ENEMY.x, ENEMY.y - (this.enemy.boss ? 30 : 0), `nemici-${this.enemy.sprite}-idle`).setDisplaySize(size, size);
    if (!reducedMotion()) this.tweens.add({ targets: this.enemyImg, y: this.enemyImg.y - 8, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    // frase del nemico, su una targa scura
    this.chipLayer = this.add.container(W / 2, 300);

    // pannello delle corsie
    const board = this.add.graphics();
    board.fillStyle(C.inchiostro, 1).fillRect(BOARD.x + 6, BOARD.y + 6, BOARD.w, BOARD.h);
    board.fillStyle(C.palcoScuro, 1).fillRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h);
    this.laneG = this.add.graphics();
    this.drawLanes(false);
    this.readout = new HearingReadout(this, BOARD.x + BOARD.w / 2, BOARD.y + BOARD.h - 18, HEX.carta);

    this.cleanup.push(engine.tracker.onOnset((o) => this.battle.onset(o.midi, o.time)));
    this.events.once("shutdown", () => this.cleanup.forEach((f) => f()));

    this.battle.startRound(engine.now + 0.3);
    this.redrawHp();
    this.sub.setText(this.enemy.trains[lang]);
    if (!save.introSeen) {
      // la prima volta basta una riga: il resto si capisce giocando
      this.sub.setText(t("firstHint")).setColor(HEX.prugna);
      save.introSeen = true;
      persist();
    }
  }

  update(): void {
    const engine = getEngine();
    engine.poll();
    const now = engine.now;
    if (this.battle.round.number !== this.scheduledRound) this.scheduleRound(this.battle.round);
    const held = engine.tracker.state.midi;
    this.battle.update(now, held);
    for (const ev of this.battle.drain()) this.handle(ev);
    this.animateBeat(now);
    // il punteggio sale a scatti fino al valore vero
    const target = this.battle.stats.score;
    if (this.shownScore !== target) {
      this.shownScore = Math.min(target, this.shownScore + Math.max(1, Math.ceil((target - this.shownScore) / 6)));
      this.scoreText.setText(String(this.shownScore));
    }
    this.animateCall(now);
    this.moveProjectiles(now);
    this.animatePoses(now, held);
    this.readout.update();
  }

  // ---------- audio e ritmo ----------

  private scheduleRound(r: Round): void {
    const engine = getEngine();
    this.scheduledRound = r.number;
    engine.basi.impostaTempo(r.bpm);
    r.countIn.forEach((tm, i) => engine.click(tm, i === 0));
    for (const n of r.call) engine.fx.voceNemico(n.midi, Math.max(0.15, n.dur * 0.85), this.enemy.timbre, n.time);
    this.buildChips(r);
    this.projectiles.forEach((p) => p.destroy());
    this.projectiles.clear();
    for (const p of r.volley) {
      const c = this.add.container(this.laneX(p.lane), LANE_TOP);
      c.add(this.add.image(0, 0, p.tab.bend ? "ui-colpo-bend" : p.tab.draw ? "ui-colpo-aspirato" : "ui-colpo-soffio").setDisplaySize(56, 56));
      if (p.tab.bend) c.add(txt(this, 0, 0, "'".repeat(p.tab.bend), 22, HEX.carta, "fori"));
      c.setVisible(false);
      this.projectiles.set(p.id, c);
    }
  }

  private animateBeat(now: number): void {
    while (this.beatTimes.length > 8) this.beatTimes.shift();
    const last = this.beatTimes.filter((b) => b <= now).pop();
    const on = last !== undefined && now - last < 0.12;
    this.beatDot.setAlpha(on ? 1 : 0.25).setScale(on ? 1.5 : 1);
  }

  // ---------- frase: Ascolta / Rispondi ----------

  private buildChips(r: Round): void {
    this.chipLayer.removeAll(true);
    this.chips = [];
    const n = r.call.length;
    const gap = Math.min(86, 1000 / n);
    const plate = this.add.graphics();
    const pw = n * gap + 40;
    plate.fillStyle(C.inchiostro, 1).fillRect(-pw / 2 + 5, -39, pw, 88);
    plate.fillStyle(C.palcoScuro, 1).fillRect(-pw / 2, -44, pw, 88);
    this.chipLayer.add(plate);
    r.call.forEach((note, i) => {
      const x = (i - (n - 1) / 2) * gap;
      const bg = this.add.graphics();
      const s = chipLabel(note);
      const label = txt(this, x, 0, s, s.length > 3 ? (gap > 70 ? 28 : 22) : gap > 70 ? 40 : 32, HEX.carta, "fori");
      this.chipLayer.add([bg, label]);
      this.chips.push({ bg, label, x, tab: note.tab });
      this.paintChip(i, "idle");
    });
  }

  private paintChip(i: number, state: "idle" | "lit" | "target" | "hit" | "short"): void {
    const c = this.chips[i];
    if (!c) return;
    c.bg.clear();
    if (state === "lit") c.bg.fillStyle(c.tab.draw ? C.indaco : C.ottone, 1).fillRoundedRect(c.x - 36, -36, 72, 72, 8);
    if (state === "target") c.bg.lineStyle(4, C.carta, 1).lineBetween(c.x - 26, 32, c.x + 26, 32);
    if (state === "hit" || state === "short") c.bg.fillStyle(state === "hit" ? 0x5f8f4a : C.prugna, 1).fillRoundedRect(c.x - 36, -36, 72, 72, 8);
    const plain = c.tab.draw ? HEX.indacoChiaro : HEX.ottone;
    c.label.setColor(state === "idle" || state === "target" ? plain : HEX.carta);
  }

  private animateCall(now: number): void {
    const b = this.battle;
    const r = b.round;
    if (b.phase === "call") {
      r.call.forEach((n, i) => this.paintChip(i, now >= n.time && now < n.time + Math.max(0.12, n.dur * 0.85) ? "lit" : "idle"));
    } else if (b.phase === "response") {
      const next = r.response.findIndex((n) => !n.hit);
      r.response.forEach((n, i) => this.paintChip(i, n.hit ? (n.short ? "short" : "hit") : i === next ? "target" : "idle"));
    }
  }

  // ---------- raffica: Para! ----------

  private laneX(lane: number): number {
    return BOARD.x + ((lane + 0.5) * BOARD.w) / this.battle.lanes.length;
  }

  private drawLanes(active: boolean): void {
    const g = this.laneG;
    g.clear();
    const lw = BOARD.w / this.battle.lanes.length;
    this.battle.lanes.forEach((_, i) => {
      g.lineStyle(2, C.carta, active ? 0.35 : 0.15).strokeRect(BOARD.x + i * lw + 6, LANE_TOP, lw - 12, HIT_Y - LANE_TOP + 36);
    });
    // linea di parata tratteggiata
    for (let x = BOARD.x + 10; x < BOARD.x + BOARD.w - 10; x += 16) g.lineStyle(3, C.ottone, active ? 1 : 0.35).lineBetween(x, HIT_Y, x + 8, HIT_Y);
    this.laneLabels ??= this.battle.lanes.map((hole, i) => txt(this, this.laneX(i), HIT_Y + 20, String(hole), 24, HEX.carta, "fori"));
    this.laneLabels.forEach((l) => l.setAlpha(active ? 1 : 0.5));
  }

  private moveProjectiles(now: number): void {
    const b = this.battle;
    const travel = TRAVEL_BEATS * b.round.beat;
    for (const p of b.round.volley) {
      const c = this.projectiles.get(p.id);
      if (!c || p.state !== "pending") continue;
      const k = 1 - (p.time - now) / travel;
      c.setVisible(b.phase === "volley" && k >= 0);
      c.y = Phaser.Math.Linear(LANE_TOP + 20, HIT_Y, Phaser.Math.Clamp(k, 0, 1.15));
    }
  }

  // ---------- pose dei personaggi ----------

  private setPose(p: Pose, until: number): void {
    this.playerImg.setTexture(`personaggi-protagonista-${p}`);
    this.poseUntil = until;
  }

  private setEnemyPose(p: EnemyPose, until: number): void {
    this.enemyImg.setTexture(`nemici-${this.enemy.sprite}-${p}`);
    this.enemyPoseUntil = until;
  }

  private animatePoses(now: number, held: number | null): void {
    if (this.ending) return;
    if (now >= this.poseUntil) this.playerImg.setTexture(`personaggi-protagonista-${held !== null ? "suona" : "idle"}`);
    if (now >= this.enemyPoseUntil) {
      const ph = this.battle.phase;
      this.enemyImg.setTexture(`nemici-${this.enemy.sprite}-${ph === "call" || ph === "volley" ? "attacco" : "idle"}`);
    }
  }

  // ---------- eventi ----------

  private handle(ev: BattleEvent): void {
    const engine = getEngine();
    const now = engine.now;
    switch (ev.type) {
      case "phase": {
        const label = { countin: t("countin"), call: t("call"), response: t("response"), volley: t("volley"), won: t("won"), lost: t("lost") }[ev.phase];
        this.banner.setText(label.toUpperCase()).setScale(1.4);
        this.tweens.add({ targets: this.banner, scale: 1, duration: 180, ease: "Back.easeOut" });
        this.drawLanes(ev.phase === "volley");
        this.chipLayer.setAlpha(ev.phase === "volley" ? 0.3 : 1);
        // mentre suoni tu la base tace, così il microfono sente solo l'armonica
        this.playerTurn = ev.phase === "response" || ev.phase === "volley";
        engine.duckBand(this.playerTurn);
        if (ev.phase === "won" || ev.phase === "lost") this.finish(ev.phase === "won");
        break;
      }
      case "responseHit": {
        this.paintChip(ev.index, "hit");
        engine.fx.notaGiusta(Math.min(ev.streak, 12));
        const chip = this.chips[ev.index];
        const cx = this.chipLayer.x + (chip?.x ?? 0);
        const color = ev.rating === "perfect" ? HEX.ottone : ev.rating === "good" ? HEX.indaco : HEX.inchiostro;
        pop(this, cx, 240, t(ev.rating).toUpperCase(), color, ev.rating === "perfect" ? 30 : 24);
        this.burst(cx, this.chipLayer.y, ev.rating === "perfect" ? C.ottone : C.indaco, ev.rating === "perfect" ? 16 : 8);
        if (chip && !reducedMotion()) this.tweens.add({ targets: chip.label, scale: 1.35, duration: 90, yoyo: true });
        this.showStreak(ev.streak);
        break;
      }
      case "streakLost":
        pop(this, W / 2, 112, t("streakLost").toUpperCase(), HEX.rosso, 22);
        this.showStreak(0);
        break;
      case "shortNote":
        this.paintChip(ev.index, "short");
        pop(this, W / 2, 380, t("hold"), HEX.prugna, 26);
        break;
      case "wrongNote":
        pop(this, W / 2, 380, `${t("wrong")}: ${noteName(ev.midi, getLang())}`, HEX.rosso, 22);
        break;
      case "enemyDamaged":
        if (ev.amount > 0) {
          engine.fx.critico();
          this.setEnemyPose("colpito", now + 0.6);
          this.tweens.add({ targets: this.enemyImg, x: ENEMY.x + 18, duration: 50, yoyo: true, repeat: 4, onComplete: () => this.enemyImg.setX(ENEMY.x) });
          this.enemyImg.setTintFill(0xffffff);
          this.time.delayedCall(90, () => this.enemyImg.clearTint());
          this.burst(ENEMY.x, ENEMY.y - 40, C.rosso, 26);
          if (!reducedMotion()) this.cameras.main.shake(180, 0.006 + Math.min(0.01, ev.amount / 4000));
          pop(this, ENEMY.x, 200, `-${ev.amount}`, HEX.rosso, 56);
        } else {
          engine.fx.notaMancata();
        }
        if (ev.onTime) pop(this, ENEMY.x, 262, t("onTime"), HEX.inchiostro, 26);
        if (ev.combo >= 2) pop(this, W / 2, 300, `${t("combo")} x${ev.combo}`, HEX.ottone, 36);
        this.redrawHp();
        break;
      case "heal":
        pop(this, ENEMY.x, 210, `+${ev.amount}`, HEX.prugna, 28);
        pop(this, W / 2, 380, t("keepPlaying"), HEX.prugna, 24);
        this.redrawHp();
        break;
      case "bossPhase": {
        const d = this.battle.currentPhase.description;
        this.sub.setText(`${t("bossPhase")} ${ev.index + 1}${d ? ` · ${d[getLang()]}` : ""}`);
        break;
      }
      case "parry": {
        const c = this.projectiles.get(ev.id);
        if (c) {
          const star = this.add.image(c.x, HIT_Y, "ui-nota-giusta").setDisplaySize(56, 56);
          this.tweens.add({ targets: star, scale: star.scale * 1.8, alpha: 0, duration: 380, onComplete: () => star.destroy() });
          this.burst(c.x, HIT_Y, C.ottone, 12);
          pop(this, c.x, HIT_Y - 50, `+${ev.points}`, HEX.ottone, 24);
          c.setVisible(false);
        }
        engine.fx.notaGiusta(Math.min(ev.streak, 12));
        this.showStreak(ev.streak);
        break;
      }
      case "playerDamaged": {
        const c = this.projectiles.get(ev.id);
        if (c) {
          const miss = this.add.image(c.x, HIT_Y, "ui-nota-mancata").setDisplaySize(48, 48);
          this.tweens.add({ targets: miss, alpha: 0, duration: 500, onComplete: () => miss.destroy() });
          c.setVisible(false);
        }
        engine.fx.danno();
        this.setPose("colpito", now + 0.5);
        if (!reducedMotion()) this.cameras.main.shake(160, 0.008);
        this.flash.setAlpha(0.28);
        this.tweens.add({ targets: this.flash, alpha: 0, duration: 260 });
        pop(this, PLAYER.x, 300, `-${ev.amount}`, HEX.rosso, 36);
        this.redrawHp();
        break;
      }
      case "difficulty":
        break;
    }
  }

  /** Scintille che esplodono da un punto. */
  private burst(x: number, y: number, color: number, n: number): void {
    if (reducedMotion()) return;
    const em = this.add.particles(x, y, "dot", {
      speed: { min: 140, max: 420 },
      scale: { start: 1, end: 0 },
      lifespan: 420,
      tint: [color, 0xffffff],
      emitting: false,
    });
    em.setDepth(20);
    em.explode(n);
    this.time.delayedCall(600, () => em.destroy());
  }

  /** La serie di colpi giusti: compare da 3 in su, festeggia ogni 10. */
  private showStreak(n: number): void {
    if (n < 3) return void this.streakText.setAlpha(0);
    this.streakText.setText(`${t("streak").toUpperCase()} x${n}`).setAlpha(1);
    if (!reducedMotion()) this.tweens.add({ targets: this.streakText, scale: { from: 1.3, to: 1 }, duration: 160 });
    if (n % 10 === 0) {
      getEngine().fx.critico();
      pop(this, W / 2, 330, `${n}!`, HEX.ottone, 72);
      this.burst(W / 2, 330, C.ottone, 30);
    }
  }

  private redrawHp(): void {
    const g = this.hp;
    g.clear();
    const bar = (x: number, frac: number, col: number, right: boolean) => {
      const w = 520;
      g.fillStyle(C.carta2, 1).fillRect(x, 54, w, 20);
      const fw = Math.max(0, w * frac);
      g.fillStyle(col, 1).fillRect(right ? x + w - fw : x, 54, fw, 20);
      g.lineStyle(3, C.inchiostro, 1).strokeRect(x, 54, w, 20);
    };
    bar(44, this.battle.enemyHp / this.enemy.hp, C.rosso, false);
    bar(W - 44 - 520, this.battle.playerHp / PLAYER_HP, C.ottone, true);
  }

  private finish(won: boolean): void {
    if (this.ending) return;
    this.ending = true;
    const engine = getEngine();
    engine.basi.ferma(0.6);
    engine.duckBand(false);
    if (won) {
      engine.fx.vittoria(engine.now + 0.2);
      this.setEnemyPose("sconfitto", Infinity);
      this.setPose("vittoria", Infinity);
      if (!save.beaten.includes(this.enemy.id)) save.beaten.push(this.enemy.id);
      persist();
    } else {
      engine.fx.sconfitta(engine.now + 0.2);
      this.setPose("colpito", Infinity);
    }
    this.time.delayedCall(1300, () => this.scene.start("result", { won, enemyId: this.enemy.id, stats: this.battle.stats }));
  }
}
