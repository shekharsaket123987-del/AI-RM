import { describe, it, expect } from "vitest";
import { computeProgress, isPlateau, daysUntil } from "../src/pipeline/computeFacts.js";
import { runSafetyPreCheck } from "../src/pipeline/safetyPreCheck.js";
import { POST_CHECK_VIOLATION_PATTERNS } from "@aihb/shared";

describe("computeProgress", () => {
  it("computes weight change in code, not via the model", () => {
    const result = computeProgress([{ weightKg: 78 }, { weightKg: 76.5 }, { weightKg: 74.8 }], undefined);
    expect(result.startWeightKg).toBe(78);
    expect(result.latestWeightKg).toBe(74.8);
    expect(result.changeKg).toBeCloseTo(3.2, 1);
    expect(result.changeDirection).toBe("loss");
  });

  it("returns empty facts when there is no weight history", () => {
    expect(computeProgress([], undefined)).toEqual({});
  });
});

describe("isPlateau", () => {
  it("flags a plateau when the last two follow-ups changed under the threshold", () => {
    expect(isPlateau([{ weightKg: 82.3 }, { weightKg: 82.4 }])).toBe(true);
  });

  it("does not flag a plateau on a real change", () => {
    expect(isPlateau([{ weightKg: 80 }, { weightKg: 82 }])).toBe(false);
  });
});

describe("daysUntil", () => {
  it("computes whole days between two dates", () => {
    const from = new Date("2026-09-25T00:00:00Z");
    const to = new Date("2026-09-28T00:00:00Z");
    expect(daysUntil(to, from)).toBe(3);
  });
});

describe("safety pre-check (PRD 18 layer 2 — runs before the model)", () => {
  it("catches an emergency/self-harm message and returns the fixed template", () => {
    const result = runSafetyPreCheck("I'm having chest pain right now");
    expect(result.matchedRule?.id).toBe("R-SAFETY");
    expect(result.fixedReply).toMatch(/emergency|urgent/i);
  });

  it("catches a medication question", () => {
    const result = runSafetyPreCheck("Can I stop my BP medicine?");
    expect(result.matchedRule?.id).toBe("R-MEDICATION");
    expect(result.fixedReply).not.toMatch(/\byes\b|\bno\b/i);
  });

  it("does not flag an ordinary message", () => {
    const result = runSafetyPreCheck("When is my next follow-up?");
    expect(result.matchedRule).toBeNull();
  });
});

describe("post-check violation regexes (PRD 18 layer 4)", () => {
  it("flags medication instructions", () => {
    const hit = POST_CHECK_VIOLATION_PATTERNS.some((r) => r.pattern.test("You should stop taking your medicine."));
    expect(hit).toBe(true);
  });

  it("flags a claim to be human", () => {
    const hit = POST_CHECK_VIOLATION_PATTERNS.some((r) => r.pattern.test("I am a real person, don't worry."));
    expect(hit).toBe(true);
  });

  it("does not flag a normal supportive reply", () => {
    const hit = POST_CHECK_VIOLATION_PATTERNS.some((r) => r.pattern.test("Thanks for sharing, Madan. What's been hardest this week?"));
    expect(hit).toBe(false);
  });
});
