import { describe, expect, it } from "vitest";
import { MAX_CHUNK_CHARS, MAX_CHUNK_COUNT, MAX_SOURCE_CHARS } from "@/lib/rewrite-limits";
import { separateChunkBoundaryFragments, splitTextIntoChunks } from "@/lib/text-chunking";

describe("splitTextIntoChunks", () => {
  it("mantém texto curto em uma única fatia, sem trimming", () => {
    const text = " \nUm texto curto.\n ";
    const chunks = splitTextIntoChunks(text, 100);

    expect(chunks).toEqual([{ text, start: 0, end: text.length }]);
  });

  it("cria fatias contíguas e reconstrói whitespace e formatação exatamente", () => {
    const text = "  título\n\nlista:\n- um\n- dois\t\n\nparágrafo final  ";
    const chunks = splitTextIntoChunks(text, 11);

    expect(chunks.map((chunk) => chunk.text).join("")).toBe(text);
    expect(chunks[0]?.start).toBe(0);
    expect(chunks.at(-1)?.end).toBe(text.length);
    expect(
      chunks.every((chunk, index) => index === 0 || chunks[index - 1]?.end === chunk.start),
    ).toBe(true);
  });

  it("não divide pares substitutos de caracteres Unicode", () => {
    const text = `${"a".repeat(25_999)}😀${"b".repeat(30_000)}`;
    const chunks = splitTextIntoChunks(text, MAX_CHUNK_CHARS);

    expect(chunks.map((chunk) => chunk.text).join("")).toBe(text);
    expect(chunks[0]?.text.endsWith("\uD83D")).toBe(false);
    expect(chunks[1]?.text.startsWith("\uDE00")).toBe(false);
  });

  it("limita a entrada máxima a 48 fatias mesmo com separadores frequentes", () => {
    const text = ("a".repeat(19_500) + "\n")
      .repeat(Math.ceil(MAX_SOURCE_CHARS / 19_501))
      .slice(0, MAX_SOURCE_CHARS);
    const chunks = splitTextIntoChunks(text, MAX_CHUNK_CHARS);

    expect(chunks.length).toBeLessThanOrEqual(MAX_CHUNK_COUNT);
    expect(chunks.every((chunk) => chunk.text.length <= MAX_CHUNK_CHARS)).toBe(true);
    expect(chunks.map((chunk) => chunk.text).join("")).toBe(text);
  });

  it("reconstrói o limite de 1,2 milhão sem ultrapassar o número de chamadas reservado", () => {
    const text = "x".repeat(MAX_SOURCE_CHARS);
    const chunks = splitTextIntoChunks(text, MAX_CHUNK_CHARS);

    expect(chunks).toHaveLength(47);
    expect(chunks.length).toBeLessThanOrEqual(MAX_CHUNK_COUNT);
    expect(chunks.every((chunk) => chunk.text.length <= MAX_CHUNK_CHARS)).toBe(true);
    expect(chunks.map((chunk) => chunk.text).join("")).toBe(text);
  });

  it("preserva fragmentos de palavra nas fronteiras duras e só separa o miolo para IA", () => {
    const text = "antes palavra-comprida depois";
    const chunks = splitTextIntoChunks(text, 12);
    const parts = chunks.map((chunk) => separateChunkBoundaryFragments(text, chunk));

    expect(parts.map(({ prefix, core, suffix }) => prefix + core + suffix).join("")).toBe(text);
    expect(parts.some(({ core }) => core.length === 0)).toBe(true);
  });

  it("rejeita um limite inválido", () => {
    expect(() => splitTextIntoChunks("texto", 0)).toThrow(RangeError);
  });
});
