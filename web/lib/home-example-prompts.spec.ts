import { describe, expect, it } from "vitest";
import {
  EXAMPLE_PROMPT_POOL,
  fnv1a32,
  pickHomeExamplePrompts,
  utcCalendarDateKey,
} from "./home-example-prompts";

describe("pickHomeExamplePrompts", () => {
  it("returns three entries from the pool", () => {
    const [a, b, c] = pickHomeExamplePrompts({
      userId: "user-1",
      now: new Date("2026-03-15T12:00:00.000Z"),
    });
    const poolPrompts = new Set(EXAMPLE_PROMPT_POOL.map((p) => p.prompt));
    expect(poolPrompts.has(a.prompt)).toBe(true);
    expect(poolPrompts.has(b.prompt)).toBe(true);
    expect(poolPrompts.has(c.prompt)).toBe(true);
  });

  it("is stable for the same user and UTC day", () => {
    const d1 = new Date("2026-03-15T08:00:00.000Z");
    const d2 = new Date("2026-03-15T23:59:00.000Z");
    expect(
      pickHomeExamplePrompts({ userId: "abc", now: d1 }),
    ).toEqual(pickHomeExamplePrompts({ userId: "abc", now: d2 }));
  });

  it("can change when the UTC calendar day changes", () => {
    const a = pickHomeExamplePrompts({
      userId: "same-user",
      now: new Date("2026-03-15T12:00:00.000Z"),
    });
    const b = pickHomeExamplePrompts({
      userId: "same-user",
      now: new Date("2026-03-16T12:00:00.000Z"),
    });
    expect(a).not.toEqual(b);
  });

  it("returns three distinct prompts when pool length ≥ 3", () => {
    const [a, b, c] = pickHomeExamplePrompts({
      userId: "any",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(new Set([a.prompt, b.prompt, c.prompt]).size).toBe(3);
  });

  it("differs between users on the same day (usually)", () => {
    const day = new Date("2026-06-01T12:00:00.000Z");
    const u1 = pickHomeExamplePrompts({ userId: "11111111-1111-1111-1111-111111111111", now: day });
    const u2 = pickHomeExamplePrompts({ userId: "22222222-2222-2222-2222-222222222222", now: day });
    expect(u1).not.toEqual(u2);
  });
});

describe("fnv1a32", () => {
  it("is deterministic", () => {
    expect(fnv1a32("a")).toBe(fnv1a32("a"));
  });
});

describe("utcCalendarDateKey", () => {
  it("uses UTC date boundary", () => {
    expect(utcCalendarDateKey(new Date("2026-04-04T23:00:00.000Z"))).toBe("2026-04-04");
    expect(utcCalendarDateKey(new Date("2026-04-05T00:30:00.000Z"))).toBe("2026-04-05");
  });
});
