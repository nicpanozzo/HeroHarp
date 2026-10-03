// Le soste della notte: ricompensa dopo un duello, banco dei pegni, portico di Zia Mae, crocevia.
import Phaser from "phaser";
import { getEngine } from "../audio/engine";
import { C, HEX, W, H, txt, button, backdrop, panel, pop, tap } from "../ui";
import { eventById, type RunEvent } from "./data";
import { addOffer, areaOf, complete, endRun, heal, nodeById, rewardOffers, rngFrom, savedRun, saveRun, shopItems, type Offer, type RunState } from "./run";
import { hud, l, offerCard, offerName, runGroove, runGrooveOnGesture, s } from "./ui";

type Mode = "reward" | "shop" | "rest" | "event";

export class RunStopScene extends Phaser.Scene {
  private run!: RunState;
  private nodeId!: string;
  private busy = false;

  constructor() {
    super("runStop");
  }

  create(data: { mode: Mode; nodeId: string; coins?: number }): void {
    const run = savedRun();
    if (!run) return void this.scene.start("runStart");
    this.run = run;
    this.nodeId = data.nodeId;
    this.busy = false;
    backdrop(this, areaOf(run).backdrop, 0.5);
    runGrooveOnGesture(this, run);
    hud(this, run);
    if (data.mode === "reward") this.reward(data.coins ?? 0);
    else if (data.mode === "shop") this.shop();
    else if (data.mode === "rest") this.rest();
    else this.event(eventById(nodeById(run, data.nodeId).eventId!));
  }

  /** Sosta finita: si segna il nodo e si torna in strada (o all'alba). */
  private leave(): void {
    if (this.busy) return;
    this.busy = true;
    const r = complete(this.run, this.nodeId);
    if (r === "dawn") endRun(this.run, "won");
    else saveRun(this.run);
    this.scene.start(r === "dawn" ? "runEnd" : "runMap");
  }

  private heading(title: string, sub?: string): void {
    txt(this, W / 2, 130, title.toUpperCase(), 44, HEX.carta, "titoli")
      .setStroke(HEX.inchiostro, 10)
      .setName("stop-title");
    if (sub) txt(this, W / 2, 176, sub, 22, HEX.ottone, "titoli").setStroke(HEX.inchiostro, 6);
  }

  /** Un annuncio grande al centro (chi si unisce, cosa hai preso), poi si riparte. */
  private announce(msg: string, then: () => void): void {
    getEngine().fx.critico();
    pop(this, W / 2, 380, msg.toUpperCase(), HEX.ottone, 40);
    this.time.delayedCall(900, then);
  }

  private take(o: Offer): string {
    addOffer(this.run, o);
    saveRun(this.run);
    // chi si unisce entra subito nella base: lo senti suonare
    runGroove(this.run);
    if (o.type === "musician") return s("joins", { name: offerName(o) });
    return o.type === "heal" ? offerName(o) : s("got", { name: offerName(o) });
  }

  // ---------- ricompensa ----------

  private reward(coins: number): void {
    const node = nodeById(this.run, this.nodeId);
    this.heading(s("reward"), coins ? s("coinsWon", { n: coins }) : undefined);
    const offers = rewardOffers(this.run, node.kind);
    const w = 290;
    const gap = 36;
    const x0 = W / 2 - ((offers.length - 1) * (w + gap)) / 2;
    offers.forEach((o, i) =>
      offerCard(this, o, x0 + i * (w + gap), 395, () => {
        if (this.busy) return;
        tap();
        const msg = this.take(o);
        this.busy = true;
        this.announce(msg, () => {
          this.busy = false;
          this.leave();
        });
      }).setName(`offer-${i}`),
    );
    button(this, W / 2, 640, s("skip"), () => this.leave(), 200, false, 46).setName("stop-skip");
    this.input.keyboard?.once("keydown-ENTER", () => this.leave());
  }

  // ---------- banco dei pegni ----------

  private shop(): void {
    this.heading(s("shopTitle"));
    const items = shopItems(this.run);
    const w = 250;
    const gap = 26;
    const x0 = W / 2 - ((items.length - 1) * (w + gap)) / 2;
    items.forEach((it, i) => {
      const x = x0 + i * (w + gap);
      let sold = false;
      const buy = () => {
        if (sold || this.busy) return;
        if (this.run.coins < it.price) return void pop(this, x, 560, s("tooPoor"), HEX.rosso, 22);
        this.run.coins -= it.price;
        sold = true;
        tap();
        pop(this, x, 300, this.take(it.offer).toUpperCase(), HEX.ottone, 26);
        getEngine().fx.critico();
        card.setAlpha(0.45).disableInteractive();
        price.setText(s("sold").toUpperCase());
        hud(this, this.run);
      };
      const card = offerCard(this, it.offer, x, 380, buy, w, 310).setName(`shop-${i}`);
      const price = txt(this, x, 565, `$ ${it.price}`, 30, this.run.coins >= it.price ? HEX.carta : HEX.rosso, "fori").setStroke(HEX.inchiostro, 7);
    });
    button(this, W / 2, 640, `${s("leave")} ▶`, () => this.leave(), 260, true, 54).setName("stop-leave");
    this.input.keyboard?.once("keydown-ENTER", () => this.leave());
  }

  // ---------- portico di Zia Mae ----------

  private rest(): void {
    this.heading(s("restTitle"));
    this.add.image(230, 450, "personaggi-zia-mae-sorride").setDisplaySize(330, 330);
    const amount = Math.round(this.run.maxHp * 0.35);
    const choice = (y: number, label: string, hint: string, name: string, act: () => void) => {
      const b = button(this, 720, y, label, act, 460, true, 66).setName(name);
      txt(this, 720, y + 52, hint, 19, HEX.carta).setStroke(HEX.inchiostro, 5);
      return b;
    };
    choice(290, s("restRest"), s("restRestHint", { n: amount }), "rest-heal", () => {
      if (this.busy) return;
      this.busy = true;
      const got = heal(this.run, amount);
      this.announce(`+${got} ♥`, () => {
        this.busy = false;
        this.leave();
      });
    });
    choice(450, s("restLesson"), s("restLessonHint"), "rest-lesson", () => {
      if (this.busy) return;
      this.busy = true;
      this.run.maxHp += 8;
      heal(this.run, 8);
      this.lesson();
    });
  }

  /** Una lezione dell'area dell'atto: passi e "se non viene", come nel viaggio. */
  private lesson(): void {
    const area = areaOf(this.run);
    const lesson = area.lessons.find((x) => !this.run.lessonsSeen.includes(x.id)) ?? area.lessons[0];
    if (!lesson) return void this.leave();
    this.run.lessonsSeen.push(lesson.id);
    saveRun(this.run);
    const layer = this.add.container(0, 0).setDepth(50);
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, C.inchiostro, 0.65).setInteractive());
    const pw = 900;
    const ph = 520;
    const x = W / 2 - pw / 2;
    const y = H / 2 - ph / 2 + 20;
    layer.add(panel(this, x, y, pw, ph));
    layer.add(this.add.image(x + 120, y + ph - 130, "personaggi-zia-mae-spiega").setDisplaySize(220, 220));
    layer.add(
      txt(this, x + pw / 2 + 80, y + 46, s("lessonFrom", { title: l(lesson.title) }).toUpperCase(), 24, HEX.inchiostro, "titoli").setWordWrapWidth(640),
    );
    const steps = lesson.steps
      .slice(0, 4)
      .map((st, i) => `${i + 1}. ${l(st)}`)
      .join("\n");
    const fix = lesson.mistakes[0] ? `\n\n${l(lesson.mistakes[0].problem)} → ${l(lesson.mistakes[0].fix)}` : "";
    layer.add(
      txt(this, x + 250, y + 90, steps + fix, 18, HEX.inchiostro)
        .setOrigin(0, 0)
        .setAlign("left")
        .setWordWrapWidth(620)
        .setLineSpacing(5),
    );
    layer.add(
      button(
        this,
        x + pw / 2 + 80,
        y + ph - 46,
        `${s("ok")} ▶`,
        () => {
          this.busy = false;
          this.leave();
        },
        260,
        true,
        54,
      ).setName("lesson-ok"),
    );
  }

  // ---------- crocevia ----------

  private event(ev: RunEvent): void {
    this.heading(s("event"), l(ev.title));
    panel(this, 110, 220, W - 220, 340);
    this.add.image(270, 390, ev.art).setDisplaySize(260, 260);
    txt(this, 760, 290, l(ev.text), 22, HEX.inchiostro).setWordWrapWidth(700).setLineSpacing(4);
    const r = { ...this.run, rng: rngFrom(this.run) };
    ev.choices.forEach((c, i) => {
      const ok = !c.can || c.can(r);
      const y = 420 + i * 82;
      const b = button(
        this,
        640,
        y,
        l(c.label),
        () => {
          if (!ok || this.busy) return;
          this.busy = true;
          const msg = c.apply(r);
          // la scelta cambia la run: si ricopiano i campi toccati dall'evento
          Object.assign(this.run, {
            hp: r.hp,
            maxHp: r.maxHp,
            coins: r.coins,
            band: r.band,
            gear: r.gear,
            groove: r.groove,
            bpmShift: r.bpmShift,
            rngState: this.run.rngState,
          });
          saveRun(this.run);
          this.announce(msg ? l(msg) : l(c.label), () => {
            this.busy = false;
            this.leave();
          });
        },
        340,
        i === 0,
        58,
      ).setName(`choice-${i}`);
      if (!ok) b.setAlpha(0.4);
      txt(this, 830, y, l(c.hint), 18, HEX.inchiostro).setOrigin(0, 0.5).setWordWrapWidth(320);
    });
  }
}
