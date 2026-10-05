// Il duello della Lunga Notte: stesse regole della battaglia del viaggio (battle/logic.ts),
// con la vita che resta da un duello all'altro, la tua band sul palco e i bonus di band e attrezzi.
import Phaser from "phaser";
import { Battle, type BattleEvent, type BattleOptions, type Round } from "../battle/logic";
import { areaById, enemyById, enemyLevel, type EnemyDef } from "../content/areas";
import { formatTab, keyById, noteName, type HarpKey, type Tab } from "../harp";
import { chipLabel } from "../scenes/BattleScene";
import { getLang, t } from "../i18n";
import { save } from "../state";
import { getEngine } from "../audio/engine";
import { grooveLevel } from "../audio/music";
import { hop } from "../scenes/beat";
import { applySettings } from "../settings";
import { HearingReadout } from "../scenes/readout";
import { C, W, H, HEX, txt, backdrop, pop, panel, button, reducedMotion, feedback, setFeedbackY } from "../ui";
import { battleLayout, type BattleLayout } from "../scenes/battleLayout";
import type { Mods } from "./data";
import { addStats, coinsFor, endRun, mods, nodeById, runEnemy, savedRun, saveRun, tally, type MapNode, type RunState } from "./run";
import { runGroove, s } from "./ui";
import { BattleRecorder } from "../stats/stats";
import { stats, persistStats } from "../stats/store";

// le posizioni stanno in scenes/battleLayout.ts, come per la battaglia del viaggio (anche in verticale)
const TRAVEL_BEATS = 4;

/** La battaglia con i bonus della run: la parata più larga se in band c'è il basso, ecc. */
class RunBattle extends Battle {
  constructor(
    enemy: EnemyDef,
    key: HarpKey,
    opts: BattleOptions,
    private parryMult: number,
  ) {
    super(enemy, key, opts);
  }
  override get parryWindow(): number {
    return super.parryWindow * this.parryMult;
  }
}

interface Chip {
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  x: number;
  tab: Tab;
}

type Pose = "idle" | "suona" | "colpito" | "vittoria";
type EnemyPose = "idle" | "attacco" | "colpito" | "sconfitto";

export class RunBattleScene extends Phaser.Scene {
  private run!: RunState;
  private node!: MapNode;
  private mods!: Mods;
  private battle!: RunBattle;
  private recorder!: BattleRecorder;
  private startedAt = 0;
  private enemy!: EnemyDef;
  private enemyImg!: Phaser.GameObjects.Image;
  private playerImg!: Phaser.GameObjects.Image;
  private banner!: Phaser.GameObjects.Text;
  private sub!: Phaser.GameObjects.Text;
  private beatDot!: Phaser.GameObjects.Arc;
  private hp!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private streakText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private shownScore = 0;
  private flash!: Phaser.GameObjects.Rectangle;
  private chips: Chip[] = [];
  private chipLayer!: Phaser.GameObjects.Container;
  private projectiles = new Map<number, Phaser.GameObjects.Container>();
  private laneG!: Phaser.GameObjects.Graphics;
  private laneLabels?: Phaser.GameObjects.Text[];
  private readout!: HearingReadout;
  private scheduledRound = 0;
  private talliedRound = 0;
  private beatTimes: number[] = [];
  private cleanup: (() => void)[] = [];
  private ending = false;
  private playerTurn = false;
  /** Arrangiamento della base per questo avversario (vedi enemyLevel). */
  private level = 0;
  private poseUntil = 0;
  private enemyPoseUntil = 0;
  private shield = 0;
  private bonusCoins = 0;
  private revived = false;
  private L!: BattleLayout;

  constructor() {
    super("runBattle");
  }

  init(data: { nodeId: string }): void {
    this.run = savedRun()!;
    this.node = this.run ? nodeById(this.run, data.nodeId) : (null as never);
    this.chips = [];
    this.projectiles.clear();
    this.laneLabels = undefined;
    this.scheduledRound = 0;
    this.talliedRound = 0;
    this.beatTimes = [];
    this.cleanup = [];
    this.ending = false;
    this.shownScore = 0;
    this.playerTurn = false;
    this.poseUntil = this.enemyPoseUntil = 0;
    this.bonusCoins = 0;
    this.revived = false;
  }

  create(): void {
    if (!this.run || !this.node?.enemyId) return void this.scene.start("runStart");
    const engine = getEngine();
    const lang = getLang();
    applySettings();
    this.mods = mods(this.run);
    this.shield = this.mods.shield;
    this.enemy = runEnemy(enemyById(this.node.enemyId), this.node.kind, this.mods.bpm);
    const area = areaById(this.enemy.areaId);
    const L = (this.L = battleLayout({ x: 165, y: 445, size: 230 }));
    const { player: PLAYER, enemy: ENEMY } = L;
    if (L.portrait) this.add.rectangle(W / 2, H / 2, W, H, C.inchiostro);
    backdrop(this, area.backdrop, 0, L.stage);
    setFeedbackY(this, L.feedbackY);

    const basi = engine.basi;
    const align = (at: number) => {
      let st = basi.prossimaBattuta();
      while (st < at - 0.01) st += 240 / this.battle.bpm;
      return st;
    };
    this.battle = new RunBattle(this.enemy, keyById(save.keyId), { align }, this.mods.parry);
    // anche la Lunga Notte alimenta la pagella
    this.recorder = new BattleRecorder(stats, keyById(save.keyId));
    this.startedAt = engine.now;
    this.battle.playerHp = this.run.hp;
    // la tua band accompagna il duello, al tempo del nemico
    // gli élite suonano un arrangiamento più carico
    this.level = enemyLevel(this.enemy) + (this.node.kind === "elite" ? 1 : 0);
    runGroove(this.run, this.battle.bpm, this.level);
    this.cleanup.push(() => engine.duckBand(false));
    this.cleanup.push(
      basi.suBattito((n, tm) => {
        this.beatTimes.push(tm);
        const st = save.settings;
        if (st.metronome && (this.playerTurn || !st.music)) engine.click(tm, n === 0);
      }),
    );
    engine.duckBand(false);

    // intestazione: nemico a sinistra, tu a destra, punti e dollari al centro;
    // in verticale le due vite una sopra l'altra, punti e dollari a destra, l'uscita a sinistra
    const kind = this.node.kind === "elite" ? ` · ${s("elite")}` : "";
    const foe = (this.enemy.name[lang] + kind).toUpperCase();
    const you = `${t("you").toUpperCase()} · ${s("act", { n: this.run.act + 1 }).toUpperCase()}`;
    // uscire non costa nulla: si torna alla mappa e il duello resta da fare
    const exit = () => this.scene.start("runMap");
    if (L.portrait) {
      panel(this, 24, 16, W - 48, 132);
      txt(this, 116, 38, foe, 20, HEX.rosso).setOrigin(0, 0.5).setLetterSpacing(2);
      txt(this, 116, 98, you, 18, HEX.ottone).setOrigin(0, 0.5).setLetterSpacing(1);
      this.hpText = txt(this, 116 + (W - 290) / 2, 126, "", 17, HEX.inchiostro, "fori").setStroke(HEX.carta, 4);
      this.scoreText = txt(this, W - 44, 38, "0", 32, HEX.inchiostro, "fori")
        .setOrigin(1, 0.5)
        .setName("score");
      this.coinText = txt(this, W - 44, 98, `$ ${this.run.coins}`, 22, HEX.inchiostro, "fori").setOrigin(1, 0.5);
      const back = button(this, 68, 82, "‹", exit, 68, false, 100).setName("exit");
      (back.list[1] as Phaser.GameObjects.Text).setFontSize(52);
    } else {
      panel(this, 24, 16, W - 48, 74);
      txt(this, 44, 38, foe, 18, HEX.rosso).setOrigin(0, 0.5).setLetterSpacing(2);
      txt(this, W - 44, 38, you, 18, HEX.ottone)
        .setOrigin(1, 0.5)
        .setLetterSpacing(2);
      this.hpText = txt(this, W - 44 - 260, 64, "", 15, HEX.inchiostro, "fori").setStroke(HEX.carta, 4);
      this.scoreText = txt(this, W / 2, 46, "0", 30, HEX.inchiostro, "fori").setName("score");
      this.coinText = txt(this, W / 2, 74, `$ ${this.run.coins}`, 17, HEX.inchiostro, "fori");
      button(this, 70, 122, "‹", exit, 64, false, 44).setName("exit");
    }
    // la vita si disegna sotto le scritte dei punti vita
    this.hp = this.add.graphics();
    this.hpText.setDepth(1);
    this.streakText = txt(this, W / 2, L.streakY, "", 26, HEX.ottone, "titoli")
      .setStroke(HEX.inchiostro, 6)
      .setAlpha(0)
      .setDepth(5);
    this.input.keyboard?.on("keydown-ESC", exit);
    this.flash = this.add.rectangle(W / 2, H / 2, W, H, C.rosso, 0).setDepth(30);
    if (!this.textures.exists("dot")) {
      const g = this.make.graphics({}, false);
      g.fillStyle(0xffffff, 1).fillCircle(6, 6, 6);
      g.generateTexture("dot", 12, 12);
      g.destroy();
    }

    const bb = L.bannerBox;
    panel(this, bb.x, bb.y, bb.w, bb.h);
    this.banner = txt(this, W / 2, L.bannerY, "", 46, HEX.inchiostro, "titoli")
      .setStroke(HEX.carta, 8)
      .setName("banner");
    this.sub = txt(this, W / 2, L.subY, "", 19, HEX.inchiostro)
      .setStroke(HEX.carta, 5)
      .setWordWrapWidth(L.subWrap);
    this.beatDot = this.add.circle(W / 2, L.beatY, 8, C.rosso).setAlpha(0.25);

    // la tua band sul palco, dietro di te: chi hai reclutato suona davvero nella base
    this.run.band.forEach((id, i) => {
      const m = this.add
        .image(38 + i * 56, (L.portrait ? PLAYER.y - 120 : 300) + (i % 2) * 14, `band-${id}-suona`)
        .setDisplaySize(L.portrait ? 96 : 86, L.portrait ? 96 : 86);
      hop(this, m, 5);
    });
    this.playerImg = this.add.image(PLAYER.x, PLAYER.y, "personaggi-protagonista-idle").setDisplaySize(PLAYER.size, PLAYER.size);
    const size = this.enemy.boss ? ENEMY.bossSize : this.node.kind === "elite" ? (ENEMY.size + ENEMY.bossSize) / 2 : ENEMY.size;
    // cono d'ombra solo sulla tappa notturna, come nella battaglia del viaggio
    if (this.enemy.areaId === "after-hours")
      this.add.image(ENEMY.x, ENEMY.y - (this.enemy.boss ? 30 : 0), this.spotTexture()).setDisplaySize(size * 1.25, size * 1.25);
    this.enemyImg = this.add.image(ENEMY.x, ENEMY.y - (this.enemy.boss ? 30 : 0), `nemici-${this.enemy.sprite}-idle`).setDisplaySize(size, size);
    if (this.node.kind === "elite") this.enemyImg.setTint(0xffd0c0);
    hop(this, this.enemyImg, 10);
    hop(this, this.playerImg, 6);

    this.chipLayer = this.add.container(W / 2, L.chipY);
    const board = this.add.graphics();
    board.fillStyle(C.inchiostro, 1).fillRect(this.L.board.x + 6, this.L.board.y + 6, this.L.board.w, this.L.board.h);
    board.fillStyle(C.palcoScuro, 1).fillRect(this.L.board.x, this.L.board.y, this.L.board.w, this.L.board.h);
    this.laneG = this.add.graphics();
    this.drawLanes(false);
    this.readout = new HearingReadout(this, this.L.board.x + this.L.board.w / 2, this.L.board.y + this.L.board.h - 18, HEX.carta);

    this.cleanup.push(engine.tracker.onOnset((o) => this.battle.onset(o.midi, o.time)));
    this.events.once("shutdown", () => {
      this.cleanup.forEach((f) => f());
      if (!this.ending) {
        this.recorder.finish(false, getEngine().now - this.startedAt, this.battle.stats.bestStreak, false);
        persistStats();
      }
      this.input.keyboard?.off("keydown-ESC");
    });

    this.battle.startRound(engine.now + 0.3);
    this.redrawHp();
    this.setSub(this.enemy.trains[lang]);
  }

  update(): void {
    if (!this.battle) return;
    const engine = getEngine();
    engine.poll();
    const now = engine.now;
    if (this.battle.round.number !== this.scheduledRound) this.scheduleRound(this.battle.round);
    const held = engine.tracker.state.midi;
    this.battle.update(now, held);
    for (const ev of this.battle.drain()) {
      this.recorder.observe(ev, this.battle);
      this.handle(ev);
    }
    this.animateBeat(now);
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
    // June copre un colpo: raffiche più corte (sempre almeno due colpi)
    const cut = Math.min(this.mods.volleyMinus, Math.max(0, r.volley.length - 2));
    if (cut > 0) {
      r.volley.splice(r.volley.length - cut, cut);
      r.end = r.volley[r.volley.length - 1].time + this.battle.parryWindow;
    }
    engine.basi.impostaTempo(r.bpm);
    r.countIn.forEach((tm, i) => engine.click(tm, i === 0));
    for (const n of r.call) engine.fx.voceNemico(n.midi, Math.max(0.15, n.dur * 0.85), this.enemy.timbre, n.time);
    this.buildChips(r);
    this.projectiles.forEach((p) => p.destroy());
    this.projectiles.clear();
    for (const p of r.volley) {
      const c = this.badge(p.tab).setPosition(this.laneX(p.lane), this.L.laneTop);
      c.setVisible(false);
      this.projectiles.set(p.id, c);
    }
  }

  private setSub(v: string): Phaser.GameObjects.Text {
    const big = this.L.portrait ? 22 : 19;
    this.sub.setFontSize(big).setText(v).setY(this.L.subY);
    if (this.sub.height > big * 1.6) this.sub.setFontSize(this.L.portrait ? 18 : 15).setY(this.L.subY + 5);
    return this.sub;
  }

  private spotTexture(): string {
    const key = "spot";
    if (!this.textures.exists(key)) {
      const c = this.textures.createCanvas(key, 256, 256)!;
      const ctx = c.getContext();
      const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
      g.addColorStop(0, "rgba(28,22,18,0.95)");
      g.addColorStop(0.5, "rgba(28,22,18,0.85)");
      g.addColorStop(1, "rgba(28,22,18,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      c.refresh();
    }
    return key;
  }

  /** Il colpo che scende: numero del foro grande su un gettone pieno (tondo = soffio, quadrato = aspirato). */
  private badge(tab: Tab): Phaser.GameObjects.Container {
    const R = this.L.portrait ? Math.min(this.L.badgeR, (0.38 * this.L.board.w) / this.battle.lanes.length) : this.L.badgeR;
    const g = this.add.graphics();
    const shape = (dx: number, color: number) => {
      g.fillStyle(color, 1);
      if (tab.draw) g.fillRoundedRect(-R + dx, -R + dx, 2 * R, 2 * R, 10);
      else g.fillCircle(dx, dx, R);
    };
    shape(5, C.inchiostro);
    shape(0, tab.draw ? C.indaco : C.ottone);
    g.lineStyle(tab.bend ? 7 : 4, tab.bend ? C.prugna : C.inchiostro, 1);
    if (tab.draw) g.strokeRoundedRect(-R, -R, 2 * R, 2 * R, 10);
    else g.strokeCircle(0, 0, R);
    const label = `${tab.hole}${"'".repeat(tab.bend)}`;
    const k = R / 32;
    const num = txt(this, 0, 1, label, Math.round((label.length > 2 ? 30 : 42) * k), tab.draw ? HEX.carta : HEX.inchiostro, "fori");
    const dot = this.add.circle(R - 4, -R + 4, Math.round(15 * k), C.inchiostro);
    const arrow = txt(this, R - 4, -R + 4, tab.draw ? "↓" : "↑", Math.round(22 * k), tab.draw ? HEX.indacoChiaro : HEX.ottone, "fori");
    return this.add.container(0, 0, [g, num, dot, arrow]);
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
    const k = this.L.chipScale;
    const gap = Math.min(86 * k, this.L.chipSpan / n);
    const plate = this.add.graphics();
    const pw = n * gap + 40;
    plate.fillStyle(C.inchiostro, 1).fillRect(-pw / 2 + 5, -44 * k + 5, pw, 88 * k);
    plate.fillStyle(C.palcoScuro, 1).fillRect(-pw / 2, -44 * k, pw, 88 * k);
    this.chipLayer.add(plate);
    r.call.forEach((note, i) => {
      const x = (i - (n - 1) / 2) * gap;
      const bg = this.add.graphics();
      const lab = chipLabel(note);
      const roomy = gap > 70 * k;
      const label = txt(this, x, 0, lab, Math.round((lab.length > 3 ? (roomy ? 28 : 22) : roomy ? 40 : 32) * k), HEX.carta, "fori");
      this.chipLayer.add([bg, label]);
      this.chips.push({ bg, label, x, tab: note.tab });
      this.paintChip(i, "idle");
    });
  }

  private paintChip(i: number, state: "idle" | "lit" | "target" | "hit" | "short"): void {
    const c = this.chips[i];
    if (!c) return;
    c.bg.clear();
    const k = this.L.chipScale;
    if (state === "lit") c.bg.fillStyle(c.tab.draw ? C.indaco : C.ottone, 1).fillRoundedRect(c.x - 36 * k, -36 * k, 72 * k, 72 * k, 8);
    if (state === "target") c.bg.lineStyle(4, C.carta, 1).lineBetween(c.x - 26 * k, 32 * k, c.x + 26 * k, 32 * k);
    if (state === "hit" || state === "short")
      c.bg.fillStyle(state === "hit" ? 0x5f8f4a : C.prugna, 1).fillRoundedRect(c.x - 36 * k, -36 * k, 72 * k, 72 * k, 8);
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
    return this.L.board.x + ((lane + 0.5) * this.L.board.w) / this.battle.lanes.length;
  }

  private drawLanes(active: boolean): void {
    const g = this.laneG;
    g.clear();
    const lw = this.L.board.w / this.battle.lanes.length;
    this.battle.lanes.forEach((_, i) => {
      g.lineStyle(2, C.carta, active ? 0.35 : 0.15).strokeRect(this.L.board.x + i * lw + 6, this.L.laneTop, lw - 12, this.L.hitY - this.L.laneTop + 36);
    });
    for (let x = this.L.board.x + 10; x < this.L.board.x + this.L.board.w - 10; x += 16)
      g.lineStyle(3, C.ottone, active ? 1 : 0.35).lineBetween(x, this.L.hitY, x + 8, this.L.hitY);
    this.laneLabels ??= this.battle.lanes.map((hole, i) => txt(this, this.laneX(i), this.L.hitY + 26, String(hole), this.L.laneLabelSize, HEX.carta, "fori"));
    this.laneLabels.forEach((lb) => lb.setAlpha(active ? 1 : 0.5));
  }

  private moveProjectiles(now: number): void {
    const b = this.battle;
    const travel = TRAVEL_BEATS * b.round.beat;
    for (const p of b.round.volley) {
      const c = this.projectiles.get(p.id);
      if (!c || p.state !== "pending") continue;
      const k = 1 - (p.time - now) / travel;
      const show = k >= 0 && (b.phase === "volley" || b.phase === "response");
      c.setVisible(show).setAlpha(b.phase === "volley" ? 1 : 0.6);
      c.y = Math.round(Phaser.Math.Linear(this.L.laneTop + 34, this.L.hitY, Phaser.Math.Clamp(k, 0, 1.15)));
    }
  }

  // ---------- pose ----------

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

  // ---------- pagella: cosa hai preso e cosa no ----------

  private tallyResponse(): void {
    const r = this.battle.round;
    if (this.talliedRound === r.number) return;
    this.talliedRound = r.number;
    for (const n of r.response) tally(this.run, chipLabel(n), !!n.hit && !n.short);
  }

  // ---------- eventi ----------

  private handle(ev: BattleEvent): void {
    const engine = getEngine();
    const now = engine.now;
    const b = this.battle;
    const L = this.L;
    const { player: PLAYER, enemy: ENEMY } = L;
    switch (ev.type) {
      case "phase": {
        if (ev.phase === "volley" || ev.phase === "won") this.tallyResponse();
        if (ev.phase === "lost" && this.tryRevive()) break;
        const label = { countin: t("countin"), call: t("call"), response: t("response"), volley: t("volley"), won: t("won"), lost: t("lost") }[ev.phase];
        this.banner.setText(label.toUpperCase()).setScale(1.4);
        this.tweens.add({ targets: this.banner, scale: 1, duration: 180, ease: "Back.easeOut" });
        this.drawLanes(ev.phase === "volley");
        const jam = this.enemy.jam;
        if (jam && b.round.call[0]?.source.free) {
          if (ev.phase === "response") {
            this.chips.forEach((c) => c.label.setText("♪"));
            this.setSub(t("jamHint", { notes: jam.allowed.map(formatTab).join(" ") }));
          } else if (ev.phase === "call") this.setSub(this.enemy.trains[getLang()]);
        }
        for (const c of this.chips) {
          c.bg.setAlpha(ev.phase === "volley" ? 0.3 : 1);
          c.label.setAlpha(ev.phase === "volley" ? 0.3 : 1);
        }
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
        feedback(this, cx, t(ev.rating).toUpperCase(), color, ev.rating === "perfect" ? 30 : 24);
        this.burst(cx, this.chipLayer.y, ev.rating === "perfect" ? C.ottone : C.indaco, ev.rating === "perfect" ? 16 : 8);
        if (chip && !reducedMotion()) this.tweens.add({ targets: chip.label, scale: 1.35, duration: 90, yoyo: true });
        if (ev.rating === "perfect") {
          // Ruby: le note perfette ridanno fiato; il cappello raccoglie le mance
          if (this.mods.perfectHeal) {
            b.playerHp = Math.min(this.run.maxHp, b.playerHp + this.mods.perfectHeal);
            this.redrawHp();
          }
          if (this.mods.perfectCoin) {
            this.bonusCoins += this.mods.perfectCoin;
            this.coinText.setText(`$ ${this.run.coins + this.bonusCoins}`);
          }
        }
        this.showStreak(ev.streak);
        break;
      }
      case "streakLost":
        pop(this, W / 2, this.L.streakY, t("streakLost").toUpperCase(), HEX.rosso, 22);
        this.showStreak(0);
        break;
      case "shortNote":
        this.paintChip(ev.index, "short");
        feedback(this, W / 2, t("hold"), HEX.prugna, 26);
        break;
      case "wrongNote":
        feedback(this, W / 2, `${t("wrong")}: ${noteName(ev.midi, getLang())}`, HEX.rosso, 22);
        break;
      case "enemyDamaged": {
        // la band e gli attrezzi colpiscono più forte
        let mult = this.mods.dmg;
        if (this.mods.streakDmg && b.streak >= 8) mult *= 1 + this.mods.streakDmg;
        const extra = ev.amount > 0 ? Math.round(ev.amount * (mult - 1)) : 0;
        const total = ev.amount + extra;
        if (extra > 0) b.enemyHp = Math.max(0, b.enemyHp - extra);
        if (total > 0) {
          engine.fx.critico();
          this.setEnemyPose("colpito", now + 0.6);
          this.tweens.add({ targets: this.enemyImg, x: ENEMY.x + 18, duration: 50, yoyo: true, repeat: 4, onComplete: () => this.enemyImg.setX(ENEMY.x) });
          this.enemyImg.setTintFill(0xffffff);
          this.time.delayedCall(90, () => (this.node.kind === "elite" ? this.enemyImg.setTint(0xffd0c0) : this.enemyImg.clearTint()));
          this.burst(ENEMY.x, ENEMY.y - 40, C.rosso, 26);
          if (!reducedMotion()) this.cameras.main.shake(180, 0.006 + Math.min(0.01, total / 4000));
          pop(this, ENEMY.x, L.enemyHitY, `-${total}`, HEX.rosso, 56);
        } else engine.fx.notaMancata();
        if (ev.onTime) pop(this, ENEMY.x, L.enemyOnTimeY, t("onTime"), HEX.inchiostro, 26);
        if (ev.combo >= 2) pop(this, W / 2, L.comboY, `${t("combo")} x${ev.combo}`, HEX.ottone, 36);
        this.redrawHp();
        // il colpo in più può bastare a vincere prima che lo decida la battaglia
        if (b.enemyHp <= 0 && b.phase !== "won") {
          b.phase = "won";
          this.handle({ type: "phase", phase: "won" });
        }
        break;
      }
      case "playerHealed":
        pop(this, PLAYER.x, PLAYER.y - 150, `+${ev.amount} ♥`, HEX.ottone, 26);
        engine.fx.critico();
        this.redrawHp();
        break;
      case "heal":
        pop(this, ENEMY.x, L.enemyHealY, `+${ev.amount}`, HEX.prugna, 28);
        pop(this, W / 2, L.keepPlayingY, t("keepPlaying"), HEX.prugna, 24);
        this.redrawHp();
        break;
      case "bossPhase": {
        const d = b.currentPhase.description;
        this.setSub(`${t("bossPhase")} ${ev.index + 1}${d ? ` · ${d[getLang()]}` : ""}`);
        grooveLevel(this.level + ev.index);
        break;
      }
      case "parry": {
        const c = this.projectiles.get(ev.id);
        const p = b.round.volley.find((x) => x.id === ev.id);
        if (p) tally(this.run, formatTab(p.tab), true);
        if (c) {
          const star = this.add.image(c.x, this.L.hitY, "ui-nota-giusta").setDisplaySize(56, 56);
          this.tweens.add({ targets: star, scale: star.scale * 1.8, alpha: 0, duration: 380, onComplete: () => star.destroy() });
          this.burst(c.x, this.L.hitY, C.ottone, 12);
          pop(this, c.x, this.L.hitY - 50, `+${ev.points}`, HEX.ottone, 24);
          c.setVisible(false);
        }
        engine.fx.notaGiusta(Math.min(ev.streak, 12));
        this.showStreak(ev.streak);
        break;
      }
      case "playerDamaged": {
        const c = this.projectiles.get(ev.id);
        const p = b.round.volley.find((x) => x.id === ev.id);
        if (p) tally(this.run, formatTab(p.tab), false);
        if (c) {
          const miss = this.add.image(c.x, this.L.hitY, "ui-nota-mancata").setDisplaySize(48, 48);
          this.tweens.add({ targets: miss, alpha: 0, duration: 500, onComplete: () => miss.destroy() });
          c.setVisible(false);
        }
        if (this.shield > 0) {
          // la custodia assorbe il colpo
          this.shield--;
          b.playerHp += ev.amount;
          if (b.phase === "lost") {
            b.phase = "volley";
            this.revived = true;
          }
          pop(this, PLAYER.x, L.playerHitY, s("shielded"), HEX.indaco, 24);
          break;
        }
        engine.fx.danno();
        this.setPose("colpito", now + 0.5);
        if (!reducedMotion()) this.cameras.main.shake(160, 0.008);
        this.flash.setAlpha(0.28);
        this.tweens.add({ targets: this.flash, alpha: 0, duration: 260 });
        pop(this, PLAYER.x, L.playerHitY, `-${ev.amount}`, HEX.rosso, 36);
        this.redrawHp();
        break;
      }
      case "difficulty":
        break;
    }
  }

  /** Sconfitta evitata: la custodia ha appena parato il colpo, o c'è l'armonica di scorta. */
  private tryRevive(): boolean {
    const b = this.battle;
    if (this.revived) {
      this.revived = false;
      b.phase = "volley";
      return true;
    }
    if (this.run.gear.includes("scorta") && !this.run.spareUsed) {
      this.run.spareUsed = true;
      b.playerHp = Math.min(this.run.maxHp, 40);
      b.phase = "volley";
      pop(this, W / 2, this.L.bigY, s("spare").toUpperCase(), HEX.ottone, 40);
      getEngine().fx.critico();
      this.redrawHp();
      return true;
    }
    return false;
  }

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

  private showStreak(n: number): void {
    if (n < 3) return void this.streakText.setAlpha(0);
    const hot = this.mods.streakDmg && n >= 8 ? " ★" : "";
    this.streakText.setText(`${t("streak").toUpperCase()} x${n}${hot}`).setAlpha(1);
    if (!reducedMotion()) this.tweens.add({ targets: this.streakText, scale: { from: 1.3, to: 1 }, duration: 160 });
    if (n % 10 === 0) {
      getEngine().fx.critico();
      pop(this, W / 2, this.L.bigY, `${n}!`, HEX.ottone, 72);
      this.burst(W / 2, this.L.bigY, C.ottone, 30);
    }
  }

  private redrawHp(): void {
    const g = this.hp;
    g.clear();
    const bar = (x: number, y: number, w: number, frac: number, col: number, right: boolean) => {
      g.fillStyle(C.carta2, 1).fillRect(x, y, w, 20);
      const fw = Math.max(0, w * Math.min(1, frac));
      g.fillStyle(col, 1).fillRect(right ? x + w - fw : x, y, fw, 20);
      g.lineStyle(3, C.inchiostro, 1).strokeRect(x, y, w, 20);
    };
    const enemy = this.battle.enemyHp / this.enemy.hp;
    const you = this.battle.playerHp / this.run.maxHp;
    if (this.L.portrait) {
      // a destra restano punti e dollari: le barre si fermano prima
      bar(116, 56, W - 290, enemy, C.rosso, false);
      bar(116, 116, W - 290, you, C.ottone, false);
    } else {
      bar(44, 54, 470, enemy, C.rosso, false);
      bar(W - 44 - 470, 54, 470, you, C.ottone, true);
    }
    this.hpText.setText(`${Math.max(0, this.battle.playerHp)} / ${this.run.maxHp}`);
  }

  private finish(won: boolean): void {
    if (this.ending) return;
    this.ending = true;
    const engine = getEngine();
    engine.duckBand(false);
    const run = this.run;
    const st = this.battle.stats;
    addStats(run, st, won);
    this.recorder.finish(won, engine.now - this.startedAt, st.bestStreak);
    persistStats();
    if (won) {
      engine.fx.vittoria(engine.now + 0.2);
      this.setEnemyPose("sconfitto", Infinity);
      this.setPose("vittoria", Infinity);
      run.hp = Math.min(run.maxHp, Math.max(1, this.battle.playerHp) + this.mods.winHeal);
      const coins = coinsFor(run, this.node.kind, st.score) + this.bonusCoins;
      run.coins += coins;
      saveRun(run);
      this.time.delayedCall(1300, () => this.scene.start("runStop", { mode: "reward", nodeId: this.node.id, coins }));
    } else {
      engine.fx.sconfitta(engine.now + 0.2);
      this.setPose("colpito", Infinity);
      run.hp = 0;
      endRun(run, "lost");
      this.time.delayedCall(1500, () => this.scene.start("runEnd"));
    }
  }
}
