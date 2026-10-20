export type TextChunk = { text: string; start: number };

export function splitTextIntoChunks(text: string, maxChars: number): TextChunk[] {
  if (!Number.isInteger(maxChars) || maxChars < 1) {
    throw new RangeError("maxChars deve ser um inteiro positivo.");
  }

  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);

    if (end < text.length) {
      const preferredStart = start + Math.floor(maxChars * 0.65);
      const boundary = ["\n\n", "\n", " "]
        .map((separator) => text.lastIndexOf(separator, end))
        .find((position) => position >= preferredStart);

      if (boundary !== undefined) end = boundary;

      const previous = text.charCodeAt(end - 1);
      const next = text.charCodeAt(end);
      const endsWithHighSurrogate = previous >= 0xd800 && previous <= 0xdbff;
      const startsWithLowSurrogate = next >= 0xdc00 && next <= 0xdfff;
      if (endsWithHighSurrogate && startsWithLowSurrogate) end -= 1;
    }

    if (end <= start) end = Math.min(start + maxChars, text.length);
    const rawChunk = text.slice(start, end);
    const leadingWhitespace = rawChunk.length - rawChunk.trimStart().length;
    const chunk = rawChunk.trim();
    if (chunk) chunks.push({ text: chunk, start: start + leadingWhitespace });

    start = end;
    while (start < text.length && /\s/.test(text[start] ?? "")) start += 1;
  }

  return chunks;
}
