// Le soste della notte: ricompensa dopo un duello, banco dei pegni, portico di Zia Mae, crocevia.
import Phaser from "phaser";
import { getEngine } from "../audio/engine";
import { C, HEX, W, H, txt, button, backdrop, panel, pop, tap, portrait } from "../ui";
import { eventById, type EventChoice, type EventRun, type RunEvent } from "./data";
import { addOffer, areaOf, complete, endRun, heal, nodeById, rewardOffers, rngFrom, savedRun, saveRun, shopItems, type Offer, type RunState } from "./run";
import { bigButton, hud, hudBottom, l, offerCard, offerName, offerRow, runGroove, runGrooveOnGesture, s, slot, spread, type Slot } from "./ui";

/** In verticale: larghezza delle carte e dei pulsanti larghi, e dove sta il pulsante in fondo. */
const PW = 660;
const footY = () => H - 76;

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

  /** Titolo della sosta; restituisce dove finisce (in verticale va a capo e può occupare due righe). */
  private heading(title: string, sub?: string): number {
    if (portrait()) {
      let y = hudBottom() + 18;
      const t = txt(this, W / 2, 0, title.toUpperCase(), 46, HEX.carta, "titoli")
        .setStroke(HEX.inchiostro, 10)
        .setWordWrapWidth(PW)
        .setName("stop-title");
      t.setY(y + t.height / 2);
      y += t.height;
      if (sub) {
        const st = txt(this, W / 2, 0, sub, 26, HEX.ottone, "titoli")
          .setStroke(HEX.inchiostro, 6)
          .setWordWrapWidth(PW);
        st.setY(y + 4 + st.height / 2);
        y += st.height + 4;
      }
      return y;
    }
    txt(this, W / 2, 130, title.toUpperCase(), 44, HEX.carta, "titoli")
      .setStroke(HEX.inchiostro, 10)
      .setName("stop-title");
    if (sub) txt(this, W / 2, 176, sub, 22, HEX.ottone, "titoli").setStroke(HEX.inchiostro, 6);
    return 190;
  }

  /** Un annuncio grande al centro (chi si unisce, cosa hai preso), poi si riparte. */
  private announce(msg: string, then: () => void): void {
    getEngine().fx.critico();
    if (portrait()) pop(this, W / 2, H / 2, msg.toUpperCase(), HEX.ottone, 40).setWordWrapWidth(PW);
    else pop(this, W / 2, 380, msg.toUpperCase(), HEX.ottone, 40);
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
    const top = this.heading(s("reward"), coins ? s("coinsWon", { n: coins }) : undefined);
    const offers = rewardOffers(this.run, node.kind);
    const pick = (o: Offer) => () => {
      if (this.busy) return;
      tap();
      const msg = this.take(o);
      this.busy = true;
      this.announce(msg, () => {
        this.busy = false;
        this.leave();
      });
    };
    if (portrait()) {
      // in verticale le carte si impilano, larghe quanto lo schermo
      const bottom = footY() - 64;
      const ch = Phaser.Math.Clamp(Math.floor((bottom - top - 30 - 24 * (offers.length - 1)) / offers.length), 170, 250);
      spread(
        offers.map((o, i) => slot(offerRow(this, o, W / 2, 0, pick(o), PW, ch).setName(`offer-${i}`), ch)),
        top + 24,
        bottom,
        36,
        16,
      );
      bigButton(this, W / 2, footY(), s("skip"), () => this.leave(), 320, false, 76).setName("stop-skip");
      this.input.keyboard?.once("keydown-ENTER", () => this.leave());
      return;
    }
    const w = 290;
    const gap = 36;
    const x0 = W / 2 - ((offers.length - 1) * (w + gap)) / 2;
    offers.forEach((o, i) => offerCard(this, o, x0 + i * (w + gap), 395, pick(o)).setName(`offer-${i}`));
    button(this, W / 2, 640, s("skip"), () => this.leave(), 200, false, 46).setName("stop-skip");
    this.input.keyboard?.once("keydown-ENTER", () => this.leave());
  }

  // ---------- banco dei pegni ----------

  private shop(): void {
    const top = this.heading(s("shopTitle"));
    const items = shopItems(this.run);
    if (portrait()) return this.shopPortrait(items, top);
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

  /** Il banco in verticale: una riga per oggetto, il prezzo grande sulla destra. */
  private shopPortrait(items: ReturnType<typeof shopItems>, top: number): void {
    const bottom = footY() - 66;
    const ch = Phaser.Math.Clamp(Math.floor((bottom - top - 30 - 20 * (items.length - 1)) / items.length), 150, 230);
    const aside = 150;
    const px = W / 2 + PW / 2 - aside / 2 - 6;
    const row = (it: (typeof items)[number], i: number, y: number) => {
      let sold = false;
      const buy = () => {
        if (sold || this.busy) return;
        if (this.run.coins < it.price) return void pop(this, px, y + 40, s("tooPoor"), HEX.rosso, 24).setWordWrapWidth(260);
        this.run.coins -= it.price;
        sold = true;
        tap();
        pop(this, W / 2, y, this.take(it.offer).toUpperCase(), HEX.ottone, 30).setWordWrapWidth(PW);
        getEngine().fx.critico();
        card.setAlpha(0.45).disableInteractive();
        price.setText(s("sold").toUpperCase()).setFontSize(24);
        hud(this, this.run);
      };
      const card = offerRow(this, it.offer, W / 2, y, buy, PW, ch, aside).setName(`shop-${i}`);
      // il prezzo sta nella colonna a destra, separata da una riga tratteggiata come uno scontrino
      const g = this.add.graphics().lineStyle(3, C.inchiostro, 0.35);
      for (let yy = y - ch / 2 + 14; yy < y + ch / 2 - 14; yy += 16) g.lineBetween(px - aside / 2, yy, px - aside / 2, yy + 8);
      const price = txt(this, px, y, `$ ${it.price}`, 36, this.run.coins >= it.price ? HEX.carta : HEX.rosso, "fori").setStroke(HEX.inchiostro, 8);
    };
    const slots: Slot[] = items.map((it, i) => ({ h: ch, at: (y) => row(it, i, y) }));
    spread(slots, top + 24, bottom, 32, 14);
    bigButton(this, W / 2, footY(), `${s("leave")} ▶`, () => this.leave(), 420, true, 84).setName("stop-leave");
    this.input.keyboard?.once("keydown-ENTER", () => this.leave());
  }

  // ---------- portico di Zia Mae ----------

  private rest(): void {
    const top = this.heading(s("restTitle"));
    const amount = Math.round(this.run.maxHp * 0.35);
    const rest = () => {
      if (this.busy) return;
      this.busy = true;
      const got = heal(this.run, amount);
      this.announce(`+${got} ♥`, () => {
        this.busy = false;
        this.leave();
      });
    };
    const learn = () => {
      if (this.busy) return;
      this.busy = true;
      this.run.maxHp += 8;
      heal(this.run, 8);
      this.lesson();
    };
    if (portrait()) {
      // Zia Mae grande in mezzo, le due scelte sotto, larghe e col loro perché
      const mae = this.add.image(W / 2, 0, "personaggi-zia-mae-sorride");
      const choice = (label: string, hint: string, name: string, act: () => void): Slot => {
        const b = bigButton(this, W / 2, 0, label, act, 560, true, 92).setName(name);
        const t = txt(this, W / 2, 0, hint, 23, HEX.carta)
          .setStroke(HEX.inchiostro, 6)
          .setWordWrapWidth(PW);
        const h = 92 + 12 + t.height;
        return {
          h,
          at: (y) => {
            b.setY(y - h / 2 + 46);
            t.setY(y - h / 2 + 104 + t.height / 2);
          },
        };
      };
      const a = choice(s("restRest"), s("restRestHint", { n: amount }), "rest-heal", rest);
      const b = choice(s("restLesson"), s("restLessonHint"), "rest-lesson", learn);
      const size = Phaser.Math.Clamp(H - 40 - top - a.h - b.h - 3 * 40, 260, 420);
      mae.setDisplaySize(size, size);
      spread([slot(mae, size), a, b], top + 10, H - 40, 50, 16);
      return;
    }
    this.add.image(230, 450, "personaggi-zia-mae-sorride").setDisplaySize(330, 330);
    const choice = (y: number, label: string, hint: string, name: string, act: () => void) => {
      const b = button(this, 720, y, label, act, 460, true, 66).setName(name);
      txt(this, 720, y + 52, hint, 19, HEX.carta).setStroke(HEX.inchiostro, 5);
      return b;
    };
    choice(290, s("restRest"), s("restRestHint", { n: amount }), "rest-heal", rest);
    choice(450, s("restLesson"), s("restLessonHint"), "rest-lesson", learn);
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
    const ok = () => {
      this.busy = false;
      this.leave();
    };
    if (portrait()) {
      // in verticale: Zia Mae e il titolo in alto, i passi a tutta larghezza, il pulsante in fondo
      const pw = W - 48;
      const head = txt(this, W / 2, 0, s("lessonFrom", { title: l(lesson.title) }).toUpperCase(), 30, HEX.inchiostro, "titoli").setWordWrapWidth(pw - 60);
      const steps = lesson.steps
        .slice(0, 4)
        .map((st, i) => `${i + 1}. ${l(st)}`)
        .join("\n\n");
      const fix = lesson.mistakes[0] ? `\n\n${l(lesson.mistakes[0].problem)} → ${l(lesson.mistakes[0].fix)}` : "";
      const body = txt(this, 48, 0, steps + fix, 23, HEX.inchiostro)
        .setOrigin(0, 0.5)
        .setAlign("left")
        .setWordWrapWidth(pw - 60)
        .setLineSpacing(4);
      const b = bigButton(this, W / 2, 0, `${s("ok")} ▶`, ok, 420, true, 88).setName("lesson-ok");
      const mae = this.add.image(W / 2, 0, "personaggi-zia-mae-spiega");
      let fixed = head.height + body.height + 88 + 3 * 22 + 64;
      // se il testo è lungo si stringe, così il pulsante resta sempre sullo schermo
      if (fixed + 150 > H - 60) {
        body.setFontSize(20).setLineSpacing(2);
        fixed = head.height + body.height + 88 + 3 * 22 + 64;
      }
      const size = Phaser.Math.Clamp(H - 60 - fixed, 130, 260);
      mae.setDisplaySize(size, size);
      const ph = Math.min(H - 40, fixed + size + 30);
      const y = H / 2 - ph / 2;
      layer.add(panel(this, 24, y, pw, ph));
      layer.add([mae, head, body, b]);
      spread([slot(mae, size), slot(head, head.height), slot(body, body.height), slot(b, 88)], y + 30, y + ph - 30, 36, 12);
      return;
    }
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
    const top = this.heading(s("event"), l(ev.title));
    const r = { ...this.run, rng: rngFrom(this.run) };
    const choose = (c: EventChoice, ok: boolean) => () => {
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
    };
    if (portrait()) return this.eventPortrait(ev, r, top, choose);
    panel(this, 110, 220, W - 220, 340);
    this.add.image(270, 390, ev.art).setDisplaySize(260, 260);
    txt(this, 760, 290, l(ev.text), 22, HEX.inchiostro).setWordWrapWidth(700).setLineSpacing(4);
    ev.choices.forEach((c, i) => {
      const ok = !c.can || c.can(r);
      const y = 420 + i * 82;
      const b = button(this, 640, y, l(c.label), choose(c, ok), 340, i === 0, 58).setName(`choice-${i}`);
      if (!ok) b.setAlpha(0.4);
      txt(this, 830, y, l(c.hint), 18, HEX.inchiostro).setOrigin(0, 0.5).setWordWrapWidth(320);
    });
  }

  /** Il crocevia in verticale: la storia in un pannello con la figura sopra, poi le scelte larghe col loro effetto. */
  private eventPortrait(ev: RunEvent, r: EventRun, top: number, choose: (c: EventChoice, ok: boolean) => () => void): void {
    const story = txt(this, W / 2, 0, l(ev.text), 24, HEX.inchiostro)
      .setWordWrapWidth(PW - 60)
      .setLineSpacing(5);
    const art = this.add.image(W / 2, 0, ev.art);
    const choices: Slot[] = ev.choices.map((c, i) => {
      const ok = !c.can || c.can(r);
      const b = bigButton(this, W / 2, 0, l(c.label), choose(c, ok), 600, i === 0, 86).setName(`choice-${i}`);
      if (!ok) b.setAlpha(0.4);
      const hint = txt(this, W / 2, 0, l(c.hint), 22, HEX.carta)
        .setStroke(HEX.inchiostro, 6)
        .setWordWrapWidth(PW);
      const h = 86 + 10 + hint.height;
      return {
        h,
        at: (y) => {
          b.setY(y - h / 2 + 43);
          hint.setY(y - h / 2 + 96 + hint.height / 2);
        },
      };
    });
    const others = choices.reduce((a, x) => a + x.h + 30, 0);
    // la figura prende lo spazio che avanza (tra 150 e 280)
    const size = Phaser.Math.Clamp(H - 40 - top - 30 - others - story.height - 70, 150, 280);
    art.setDisplaySize(size, size);
    const ph = size + story.height + 70;
    const card: Slot = {
      h: ph,
      at: (y) => {
        const y0 = y - ph / 2;
        panel(this, W / 2 - PW / 2, y0, PW, ph);
        // il pannello nasce dopo figura e testo: li si riporta davanti
        this.children.bringToTop(art);
        this.children.bringToTop(story);
        art.setY(y0 + 24 + size / 2);
        story.setY(y0 + 24 + size + 20 + story.height / 2);
      },
    };
    spread([card, ...choices], top + 24, H - 40, 44, 18);
  }
}
