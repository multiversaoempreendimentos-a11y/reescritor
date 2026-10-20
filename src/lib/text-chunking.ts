export type TextChunk = { text: string; start: number; end: number };
export type ChunkRewriteParts = { prefix: string; core: string; suffix: string };

function isHighSurrogate(code: number) {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number) {
  return code >= 0xdc00 && code <= 0xdfff;
}

export function splitTextIntoChunks(text: string, maxChars: number): TextChunk[] {
  if (!Number.isInteger(maxChars) || maxChars < 1) {
    throw new RangeError("maxChars deve ser um inteiro positivo.");
  }

  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (
      end < text.length &&
      isHighSurrogate(text.charCodeAt(end - 1)) &&
      isLowSurrogate(text.charCodeAt(end))
    ) {
      end -= 1;
    }
    // Um ponto de código astral ocupa dois code units; com maxChars=1, mantenha-o íntegro.
    if (end <= start) end = Math.min(start + 2, text.length);

    chunks.push({ text: text.slice(start, end), start, end });
    start = end;
  }

  return chunks;
}

/**
 * Mantém intactos fragmentos de palavra cortados na fronteira das fatias e
 * espaços externos; somente o miolo completo é enviado para reescrita.
 */
export function separateChunkBoundaryFragments(
  source: string,
  chunk: TextChunk,
): ChunkRewriteParts {
  let prefixEnd = 0;
  if (chunk.start > 0 && !/\s/u.test(source[chunk.start - 1] ?? "")) {
    const firstWhitespace = chunk.text.search(/\s/u);
    prefixEnd = firstWhitespace < 0 ? chunk.text.length : firstWhitespace + 1;
  }

  let suffixStart = chunk.text.length;
  if (chunk.end < source.length && !/\s/u.test(source[chunk.end] ?? "")) {
    const whitespaceMatches = Array.from(chunk.text.matchAll(/\s/gu));
    suffixStart = whitespaceMatches.at(-1)?.index ?? 0;
  }

  if (suffixStart < prefixEnd) {
    return { prefix: chunk.text, core: "", suffix: "" };
  }

  const coreWithWhitespace = chunk.text.slice(prefixEnd, suffixStart);
  const leadingWhitespace = coreWithWhitespace.match(/^\s*/u)?.[0] ?? "";
  const afterLeadingWhitespace = coreWithWhitespace.slice(leadingWhitespace.length);
  const trailingWhitespace = afterLeadingWhitespace.match(/\s*$/u)?.[0] ?? "";
  const core = afterLeadingWhitespace.slice(
    0,
    afterLeadingWhitespace.length - trailingWhitespace.length,
  );

  return {
    prefix: chunk.text.slice(0, prefixEnd) + leadingWhitespace,
    core,
    suffix: trailingWhitespace + chunk.text.slice(suffixStart),
  };
}
