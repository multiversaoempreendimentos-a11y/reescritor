import { describe, expect, it } from "vitest";
import { extractCompletedAIOutput, isLikelyTruncatedAIOutput } from "@/lib/ai-response";
import { MAX_REWRITE_OUTPUT_TOKENS } from "@/lib/rewrite-limits";

describe("isLikelyTruncatedAIOutput", () => {
  it("detecta motivos de término que indicam limite", () => {
    expect(isLikelyTruncatedAIOutput({ finish_reason: "length" }, 10_000)).toBe(true);
    expect(isLikelyTruncatedAIOutput({ finish_reason: "max_tokens" }, 10_000)).toBe(true);
    expect(isLikelyTruncatedAIOutput({ finish_reason: "stop" }, 10_000)).toBe(false);
  });

  it("detecta completion_tokens próximos ao teto e aceita respostas abaixo da margem", () => {
    expect(
      isLikelyTruncatedAIOutput(
        { usage: { completion_tokens: MAX_REWRITE_OUTPUT_TOKENS - 64 } },
        MAX_REWRITE_OUTPUT_TOKENS,
      ),
    ).toBe(true);
    expect(
      isLikelyTruncatedAIOutput(
        { usage: { completion_tokens: MAX_REWRITE_OUTPUT_TOKENS - 65 } },
        MAX_REWRITE_OUTPUT_TOKENS,
      ),
    ).toBe(false);
    expect(isLikelyTruncatedAIOutput({}, MAX_REWRITE_OUTPUT_TOKENS)).toBe(false);
  });
});

describe("extractCompletedAIOutput", () => {
  it("remove o marcador técnico apenas quando ele está na última linha", () => {
    expect(extractCompletedAIOutput("Texto reescrito.\nMARCADOR-UNICO", "MARCADOR-UNICO")).toBe(
      "Texto reescrito.",
    );
    expect(
      extractCompletedAIOutput("Texto reescrito.\nMARCADOR-UNICO\nextra", "MARCADOR-UNICO"),
    ).toBe(null);
    expect(extractCompletedAIOutput("Texto reescrito sem marcador.", "MARCADOR-UNICO")).toBe(null);
  });
});
