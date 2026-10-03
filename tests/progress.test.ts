import { describe, it, expect } from "vitest";
import { AREAS, JOURNEY, areaById } from "../src/content/areas";
import { areaUnlocked, enemyUnlocked, currentArea, nextEnemy, starsFor } from "../src/progress";

const boss = (id: string) => areaById(id).enemies.find((e) => e.boss)!.id;
const normals = (id: string) =>
  areaById(id)
    .enemies.filter((e) => !e.boss && !e.comingSoon)
    .map((e) => e.id);

describe("il viaggio", () => {
  it("all'inizio è aperta solo la prima tappa", () => {
    const open = AREAS.filter((a) => areaUnlocked(a, { beaten: [] }));
    expect(open.map((a) => a.id)).toEqual(["porch"]);
    expect(currentArea({ beaten: [] }).id).toBe("porch");
  });

  it("battere il boss apre la tappa successiva e l'Extra", () => {
    const p = { beaten: [...normals("porch"), boss("porch")] };
    expect(areaUnlocked(areaById("station"), p)).toBe(true);
    expect(areaUnlocked(areaById("freight-train"), p)).toBe(false);
    expect(areaUnlocked(areaById("after-hours"), p)).toBe(!areaById("after-hours").comingSoon);
    expect(currentArea(p).id).toBe("station");
  });

  it("il boss si apre dopo gli altri nemici della tappa", () => {
    const silence = areaById("porch").enemies.find((e) => e.boss)!;
    expect(enemyUnlocked(silence, { beaten: normals("porch").slice(1) })).toBe(false);
    expect(enemyUnlocked(silence, { beaten: normals("porch") })).toBe(true);
  });

  it("una tappa in arrivo non blocca quella dopo", () => {
    const soon = JOURNEY.find((a) => a.comingSoon);
    if (!soon) return;
    const prev = JOURNEY.filter((a) => a.order < soon.order && !a.comingSoon).pop()!;
    const after = JOURNEY.find((a) => a.order > soon.order && !a.comingSoon);
    if (after) expect(areaUnlocked(after, { beaten: [boss(prev.id)] })).toBe(true);
  });

  it("con l'opzione aperta si va ovunque tranne dove manca ancora la grafica", () => {
    for (const a of AREAS) expect(areaUnlocked(a, { beaten: [], openAll: true })).toBe(!a.comingSoon);
  });
});

describe("gioca subito", () => {
  it("parte dal primo nemico non battuto della tappa attuale", () => {
    expect(nextEnemy({ beaten: [] }).id).toBe("draft");
    expect(nextEnemy({ beaten: ["draft"] }).id).toBe("sigh");
    expect(nextEnemy({ beaten: [...normals("porch")] }).id).toBe("silence");
    expect(nextEnemy({ beaten: [...normals("porch"), boss("porch")] }).areaId).toBe("station");
  });

  it("dà le stelle in base a note giuste e colpi presi", () => {
    expect(starsFor(true, { notesHit: 10, notesExpected: 10, missed: 0 })).toBe(3);
    expect(starsFor(true, { notesHit: 8, notesExpected: 10, missed: 3 })).toBe(2);
    expect(starsFor(true, { notesHit: 5, notesExpected: 10, missed: 3 })).toBe(1);
    expect(starsFor(false, { notesHit: 10, notesExpected: 10, missed: 0 })).toBe(0);
  });
});
