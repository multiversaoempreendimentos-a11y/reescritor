import { OUTPUT_TRUNCATION_SAFETY_MARGIN } from "./rewrite-limits";

export type WorkersAIOutputMetadata = {
  response?: string;
  finish_reason?: string;
  usage?: { completion_tokens?: number };
};

export function extractCompletedAIOutput(
  response: string | undefined,
  marker: string,
): string | null {
  if (!response || !marker) return null;
  const normalized = response.trimEnd();
  const markerLine = `\n${marker}`;
  if (!normalized.endsWith(markerLine)) return null;
  return normalized.slice(0, -markerLine.length);
}

export function isLikelyTruncatedAIOutput(
  output: WorkersAIOutputMetadata,
  maxTokens: number,
): boolean {
  const finishReason = output.finish_reason?.toLowerCase();
  if (["length", "max_tokens", "max_length", "token_limit"].includes(finishReason ?? "")) {
    return true;
  }

  const completionTokens = output.usage?.completion_tokens;
  return (
    typeof completionTokens === "number" &&
    Number.isFinite(completionTokens) &&
    completionTokens >= maxTokens - OUTPUT_TRUNCATION_SAFETY_MARGIN
  );
}
