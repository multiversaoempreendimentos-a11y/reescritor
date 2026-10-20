import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "@/lib/map-with-concurrency";

describe("mapWithConcurrency", () => {
  it("preserva a ordem e respeita o número máximo de tarefas simultâneas", async () => {
    let active = 0;
    let peak = 0;

    const result = await mapWithConcurrency([0, 1, 2, 3, 4, 5, 6], 3, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return value * 2;
    });

    expect(result).toEqual([0, 2, 4, 6, 8, 10, 12]);
    expect(peak).toBe(3);
  });

  it("rejeita limites inválidos", async () => {
    await expect(mapWithConcurrency([1], 0, async (value) => value)).rejects.toThrow(RangeError);
  });

  it("para de agendar novos itens após uma falha", async () => {
    const started: number[] = [];

    await expect(
      mapWithConcurrency([0, 1, 2, 3, 4], 1, async (value) => {
        started.push(value);
        if (value === 1) throw new Error("falha simulada");
        return value;
      }),
    ).rejects.toThrow("falha simulada");

    expect(started).toEqual([0, 1]);
  });
});
