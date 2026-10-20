import { describe, expect, it } from "vitest";
import { splitTextIntoChunks } from "@/lib/text-chunking";

describe("splitTextIntoChunks", () => {
  it("mantém texto curto em um único trecho", () => {
    expect(splitTextIntoChunks("Um texto curto.", 20)).toEqual([
      { text: "Um texto curto.", start: 0 },
    ]);
  });

  it("divide em limites de parágrafo sempre que possível", () => {
    const text = `${"A".repeat(12)}\n\n${"B".repeat(12)}`;
    const chunks = splitTextIntoChunks(text, 16);

    expect(chunks.map((chunk) => chunk.text)).toEqual(["A".repeat(12), "B".repeat(12)]);
    expect(chunks[1]?.start).toBe(14);
    expect(chunks.every((chunk) => chunk.text.length <= 16)).toBe(true);
  });

  it("divide parágrafos longos sem exceder o máximo", () => {
    const text = "conteúdo ".repeat(20);
    const chunks = splitTextIntoChunks(text, 17);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.text.length <= 17)).toBe(true);
    expect(
      chunks
        .map((chunk) => chunk.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    ).toBe(text.replace(/\s+/g, " ").trim());
  });

  it("rejeita um limite inválido", () => {
    expect(() => splitTextIntoChunks("texto", 0)).toThrow(RangeError);
  });
});
