import Phaser from "phaser";
import { Battle, PLAYER_HP, type BattleEvent, type Round } from "../battle/logic";
import { enemyById, type EnemyDef } from "../content/enemies";
import { formatTab, keyById, midiToTabs, noteName } from "../harp";
import { getLang, t } from "../i18n";
import { save, persist } from "../state";
import { getEngine } from "../audio/engine";
import { C, W, H, txt, stage, drawEnemy, pop, hex } from "../ui";
import { HearingReadout } from "./readout";

const LANE_TOP = 318;
const LANE_BOTTOM = 492;
const PARRY_X = 210;
const SPAWN_X = 900;
/** Battiti che un colpo impiega ad attraversare la corsia. */
const TRAVEL_BEATS = 3;

interface Chip {
  box: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  sub: Phaser.GameObjects.Text;
  draw: boolean;
}

export class BattleScene extends Phaser.Scene {
  private battle!: Battle;
  private enemy!: EnemyDef;
  private enemyFig!: Phaser.GameObjects.Container;
  private banner!: Phaser.GameObjects.Text;
  private beatDot!: Phaser.GameObjects.Arc;
  private hpBars!: { player: Phaser.GameObjects.Graphics; enemy: Phaser.GameObjects.Graphics };
  private chips: Chip[] = [];
  private chipLayer!: Phaser.GameObjects.Container;
  private projectiles = new Map<number, Phaser.GameObjects.Container>();
  private laneG!: Phaser.GameObjects.Graphics;
  private harpG!: Phaser.GameObjects.Graphics;
  private readout!: HearingReadout;
  private scheduledRound = 0;
  private beatTimes: number[] = [];
  private unsub: (() => void) | null = null;
  private ending = false;

  constructor() {
    super("battle");
  }

  init(data: { enemyId: string }): void {
    this.enemy = enemyById(data.enemyId);
    this.chips = [];
    this.projectiles.clear();
    this.scheduledRound = 0;
    this.beatTimes = [];
    this.ending = false;
  }

  create(): void {
    const engine = getEngine();
    const lang = getLang();
    stage(this);
    this.battle = new Battle(this.enemy, keyById(save.keyId));

    // barre della vita
    this.hpBars = { player: this.add.graphics(), enemy: this.add.graphics() };
    txt(this, 40, 26, t("you"), 18, C.cream, true).setOrigin(0, 0.5);
    txt(this, W - 40, 26, this.enemy.name[lang], 18, C.cream, true).setOrigin(1, 0.5);

    this.banner = txt(this, W / 2, 70, "", 34, C.brass, true).setStroke("#000", 6).setName("banner");
    this.beatDot = this.add.circle(W / 2, 108, 6, C.brass).setAlpha(0.2);

    this.enemyFig = drawEnemy(this, 800, 200, this.enemy, 0.8);
    this.tweens.add({ targets: this.enemyFig, y: 192, duration: (60 / this.enemy.bpm) * 1000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.harpG = this.add.graphics();

    this.chipLayer = this.add.container(W / 2, 200);
    this.laneG = this.add.graphics();
    this.drawLanes(false);

    this.readout = new HearingReadout(this, W / 2, H - 17);
    this.unsub = engine.tracker.onOnset((o) => this.battle.onset(o.midi, o.time));
    this.events.once("shutdown", () => this.unsub?.());

    this.battle.startRound(engine.now + 0.6);
    this.redrawHp();
    pop(this, 800, 90, this.enemy.taunt[lang], C.muted, 18);
  }

  update(): void {
    const engine = getEngine();
    engine.poll();
    const now = engine.now;
    if (this.battle.round.number !== this.scheduledRound) this.scheduleRound(this.battle.round);
    this.battle.update(now, engine.tracker.state.midi);
    for (const ev of this.battle.drain()) this.handle(ev);
    this.scheduleBeats(now);
    this.animateBeat(now);
    this.animateCall(now);
    this.moveProjectiles(now);
    this.drawHarp(engine.tracker.state.midi);
    this.readout.update();
  }

  // ---------- audio e ritmo ----------

  private scheduleRound(r: Round): void {
    const engine = getEngine();
    this.scheduledRound = r.number;
    r.countIn.forEach((tm, i) => engine.click(tm, i === 0));
    for (const n of r.call) engine.playNote(n.midi, n.time, r.beat * 0.7);
    this.beatTimes = [...r.countIn];
    this.nextBeat = r.countIn[3] + r.beat;
    this.buildChips(r);
    this.projectiles.forEach((p) => p.destroy());
    this.projectiles.clear();
    for (const p of r.volley) {
      const c = this.add.container(SPAWN_X, this.laneY(p.lane));
      const col = p.tab.draw ? C.draw : C.blow;
      const g = this.add.graphics();
      g.fillStyle(col, 0.25).fillCircle(0, 0, 24);
      g.fillStyle(col, 1).fillCircle(0, 0, 17);
      c.add([g, txt(this, 0, 0, formatTab(p.tab), 14, C.bg).setFontStyle("700")]);
      c.setVisible(false);
      this.projectiles.set(p.id, c);
    }
  }

  private nextBeat = 0;

  /** Groove: programma la cassa poco prima di ogni battito, così segue la fine anticipata del round. */
  private scheduleBeats(now: number): void {
    const r = this.battle.round;
    const engine = getEngine();
    while (this.nextBeat < now + 0.15 && this.nextBeat < r.end - 0.01) {
      const tm = this.nextBeat;
      this.beatTimes.push(tm);
      engine.kick(tm);
      if (this.battle.phase === "response" && tm >= r.callEnd) engine.click(tm, false);
      this.nextBeat += r.beat;
    }
  }

  private animateBeat(now: number): void {
    const last = this.beatTimes.filter((b) => b <= now).pop();
    const age = last === undefined ? 1 : now - last;
    this.beatDot.setAlpha(age < 0.12 ? 1 : 0.2).setScale(age < 0.12 ? 1.6 : 1);
  }

  // ---------- frase: Ascolta / Rispondi ----------

  private buildChips(r: Round): void {
    this.chipLayer.removeAll(true);
    this.chips = [];
    const n = r.call.length;
    const gap = 78;
    r.call.forEach((note, i) => {
      const x = (i - (n - 1) / 2) * gap;
      const box = this.add.graphics();
      const label = txt(this, x, -6, formatTab(note.tab), 24, C.cream, true);
      const sub = txt(this, x, 20, noteName(note.midi, getLang()), 12, C.muted);
      this.chipLayer.add([box, label, sub]);
      const chip = { box, label, sub, draw: note.tab.draw };
      this.chips.push(chip);
      this.paintChip(i, "idle", x);
    });
  }

  private paintChip(i: number, state: "idle" | "lit" | "target" | "hit" | "miss", x?: number): void {
    const c = this.chips[i];
    if (!c) return;
    const cx = x ?? c.label.x;
    const col = c.draw ? C.draw : C.blow;
    c.box.clear();
    const fill = { idle: C.bgLight, lit: col, target: C.bgLight, hit: C.good, miss: C.bgLight }[state];
    c.box.fillStyle(fill, state === "lit" ? 0.9 : 1).fillRoundedRect(cx - 34, -34, 68, 68, 10);
    const stroke = { idle: C.wood, lit: col, target: C.brass, hit: C.good, miss: C.bad }[state];
    c.box.lineStyle(state === "target" ? 4 : 2, stroke, 1).strokeRoundedRect(cx - 34, -34, 68, 68, 10);
    c.label.setColor(state === "lit" || state === "hit" ? hex(C.bg) : hex(col));
  }

  private animateCall(now: number): void {
    const b = this.battle;
    const r = b.round;
    if (b.phase === "call") {
      r.call.forEach((n, i) => this.paintChip(i, now >= n.time && now < n.time + r.beat * 0.7 ? "lit" : "idle"));
    } else if (b.phase === "response") {
      const next = r.response.findIndex((n) => !n.hit);
      r.response.forEach((n, i) => this.paintChip(i, n.hit ? "hit" : i === next ? "target" : "idle"));
    }
  }

  // ---------- raffica: Para! ----------

  private laneY(lane: number): number {
    const n = this.battle.lanes.length;
    return LANE_TOP + ((lane + 0.5) * (LANE_BOTTOM - LANE_TOP)) / n;
  }

  private drawLanes(active: boolean): void {
    const g = this.laneG;
    g.clear();
    const n = this.battle.lanes.length;
    const h = (LANE_BOTTOM - LANE_TOP) / n;
    this.battle.lanes.forEach((tab, i) => {
      const y = this.laneY(i);
      g.fillStyle(i % 2 ? C.bgLight : C.bg, active ? 0.9 : 0.5).fillRect(150, y - h / 2, 780, h);
      g.fillStyle(tab.draw ? C.draw : C.blow, active ? 1 : 0.4).fillRoundedRect(110, y - h / 2 + 3, 46, h - 6, 6);
    });
    g.lineStyle(3, C.brass, active ? 1 : 0.3).lineBetween(PARRY_X, LANE_TOP, PARRY_X, LANE_BOTTOM);
    if (!this.laneLabels) {
      this.laneLabels = this.battle.lanes.map((tab, i) => txt(this, 133, this.laneY(i), formatTab(tab), 14, C.bg).setFontStyle("700"));
    }
  }
  private laneLabels?: Phaser.GameObjects.Text[];

  private moveProjectiles(now: number): void {
    const b = this.battle;
    const travel = TRAVEL_BEATS * b.round.beat;
    for (const p of b.round.volley) {
      const c = this.projectiles.get(p.id);
      if (!c || p.state !== "pending") continue;
      const k = 1 - (p.time - now) / travel;
      c.setVisible(b.phase === "volley" && k >= 0);
      c.x = Phaser.Math.Linear(SPAWN_X, PARRY_X, Phaser.Math.Clamp(k, 0, 1.2));
    }
  }

  // ---------- armonica del giocatore ----------

  private drawHarp(midi: number | null): void {
    const g = this.harpG;
    const x0 = 40, y0 = 160;
    g.clear();
    g.fillStyle(C.brassDark, 1).fillRoundedRect(x0, y0, 290, 52, 10);
    g.fillStyle(C.brass, 1).fillRoundedRect(x0 + 4, y0 + 4, 282, 44, 8);
    const tabs = midi === null ? [] : midiToTabs(midi, keyById(save.keyId));
    for (let i = 0; i < 10; i++) {
      const on = tabs.find((tb) => tb.hole === i + 1);
      g.fillStyle(on ? (on.draw ? C.draw : C.blow) : C.bg, 1).fillRoundedRect(x0 + 14 + i * 27, y0 + 16, 18, 20, 4);
    }
    if (!this.holeNums) {
      this.holeNums = [];
      for (let i = 0; i < 10; i++) this.holeNums.push(txt(this, x0 + 23 + i * 27, y0 + 64, String(i + 1), 12, C.muted));
    }
  }
  private holeNums?: Phaser.GameObjects.Text[];

  // ---------- eventi ----------

  private handle(ev: BattleEvent): void {
    const engine = getEngine();
    switch (ev.type) {
      case "phase": {
        const label = { countin: t("countin"), call: t("call"), response: t("response"), volley: t("volley"), won: t("won"), lost: t("lost") }[ev.phase];
        this.banner.setText(label).setScale(1.3);
        this.tweens.add({ targets: this.banner, scale: 1, duration: 250 });
        this.drawLanes(ev.phase === "volley");
        this.chipLayer.setAlpha(ev.phase === "volley" ? 0.35 : 1);
        if (ev.phase === "won" || ev.phase === "lost") this.finish(ev.phase === "won");
        break;
      }
      case "responseHit":
        this.paintChip(ev.index, "hit");
        pop(this, W / 2 + (ev.index - (this.chips.length - 1) / 2) * 78, 150, "✓", C.good, 22);
        break;
      case "wrongNote":
        pop(this, W / 2, 262, `${t("wrong")}: ${noteName(ev.midi, getLang())}`, C.bad, 16);
        break;
      case "enemyDamaged":
        if (ev.amount > 0) {
          engine.sfx("hit");
          this.tweens.add({ targets: this.enemyFig, x: 815, duration: 60, yoyo: true, repeat: 3 });
          pop(this, 800, 120, `-${ev.amount}`, C.brass, 34);
        }
        if (ev.onTime) pop(this, 800, 80, t("onTime"), C.good, 22);
        if (ev.combo >= 2) pop(this, 640, 120, `${t("combo")} x${ev.combo}`, C.brass, 22);
        this.redrawHp();
        break;
      case "parry": {
        const c = this.projectiles.get(ev.id);
        if (c) {
          this.tweens.add({ targets: c, scale: 2, alpha: 0, duration: 220, onComplete: () => c.setVisible(false) });
          pop(this, PARRY_X + 40, c.y - 10, "✓", C.good, 22);
        }
        break;
      }
      case "playerDamaged": {
        const c = this.projectiles.get(ev.id);
        c?.setVisible(false);
        engine.sfx("hurt");
        this.cameras.main.shake(150, 0.006);
        pop(this, 185, 140, `-${ev.amount}`, C.bad, 30);
        this.redrawHp();
        break;
      }
      case "difficulty":
        break;
    }
  }

  private redrawHp(): void {
    const draw = (g: Phaser.GameObjects.Graphics, x: number, frac: number, col: number, alignRight: boolean) => {
      g.clear();
      g.fillStyle(C.bgLight, 1).fillRoundedRect(x, 42, 300, 14, 7);
      const w = Math.max(0, 300 * frac);
      g.fillStyle(col, 1).fillRoundedRect(alignRight ? x + 300 - w : x, 42, Math.max(w, 1), 14, 7);
    };
    draw(this.hpBars.player, 40, this.battle.playerHp / PLAYER_HP, C.good, false);
    draw(this.hpBars.enemy, W - 340, this.battle.enemyHp / this.enemy.hp, C.draw, true);
  }

  private finish(won: boolean): void {
    if (this.ending) return;
    this.ending = true;
    const engine = getEngine();
    engine.sfx(won ? "win" : "lose", engine.now + 0.1);
    if (won) {
      if (!save.beaten.includes(this.enemy.id)) save.beaten.push(this.enemy.id);
      persist();
      this.tweens.add({ targets: this.enemyFig, alpha: 0, angle: 20, y: 260, duration: 700 });
    }
    this.time.delayedCall(1600, () => this.scene.start("result", { won, enemyId: this.enemy.id, stats: this.battle.stats }));
  }
}
