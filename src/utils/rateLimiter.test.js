import { describe, it, expect, beforeEach } from "vitest";
import { rateLimited, resetRateLimiter } from "./rateLimiter";

describe("rateLimiter", () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it("executes a single function", async () => {
    const result = await rateLimited(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it("propagates errors", async () => {
    await expect(
      rateLimited(() => Promise.reject(new Error("fail")))
    ).rejects.toThrow("fail");
  });

  it("executes multiple requests sequentially", async () => {
    const order = [];
    const makeTask = (id) => rateLimited(async () => {
      order.push(id);
      return id;
    });

    const results = await Promise.all([makeTask(1), makeTask(2), makeTask(3)]);
    expect(results).toEqual([1, 2, 3]);
    expect(order).toEqual([1, 2, 3]);
  });

  it("respects max concurrent limit", async () => {
    let maxActive = 0;
    let active = 0;

    const tasks = Array.from({ length: 10 }, (_, i) =>
      rateLimited(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise(r => setTimeout(r, 10));
        active--;
        return i;
      })
    );

    await Promise.all(tasks);
    expect(maxActive).toBeLessThanOrEqual(6);
  });
});
