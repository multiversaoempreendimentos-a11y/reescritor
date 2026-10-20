import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  MAX_CHUNK_CHARS,
  MAX_CHUNK_CONCURRENCY,
  MAX_CHUNK_CONTEXT_CHARS,
  MAX_CHUNK_COUNT,
  MAX_REWRITE_OUTPUT_TOKENS,
  MAX_SOURCE_CHARS,
  MAX_WORKER_SUBREQUESTS,
  RESERVED_WORKER_SUBREQUESTS,
} from "./rewrite-limits";
import { extractCompletedAIOutput, isLikelyTruncatedAIOutput } from "./ai-response";
import { buildRewriteMessages, type RewriteTone } from "./rewrite-prompt";
import { mapWithConcurrency } from "./map-with-concurrency";
import { separateChunkBoundaryFragments, splitTextIntoChunks } from "./text-chunking";

const MAX_TOTAL_PDF_BASE64 = 30_000_000;
const AI_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const AI_OUTPUT_TRUNCATED = "AI_OUTPUT_TRUNCATED";

type WorkersAIResponse = {
  response?: string;
  finish_reason?: string;
  usage?: { completion_tokens?: number };
};

type MarkdownConversion = { name: string; format: string; data?: string; error?: string };
type CloudflareAI = {
  run(
    model: string,
    input: {
      messages: Array<{ role: "system" | "user"; content: string }>;
      max_tokens: number;
      temperature: number;
    },
  ): Promise<WorkersAIResponse>;
  toMarkdown(files: Array<{ name: string; blob: Blob }>): Promise<MarkdownConversion[]>;
};
type CloudflareRateLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

type CloudflareRequest = Request & {
  runtime?: {
    cloudflare?: { env?: { AI?: CloudflareAI; AI_RATE_LIMITER?: CloudflareRateLimiter } };
  };
};

const schema = z
  .object({
    material: z.string().max(MAX_SOURCE_CHARS).default(""),
    pdfs: z
      .array(
        z.object({
          nome: z.string().min(1).max(300),
          base64: z.string().min(1).max(15_000_000),
        }),
      )
      .max(5)
      .default([]),
    foco: z.string().max(140).default(""),
    tom: z.enum(["refinada", "formal", "academica", "juridica"]).default("refinada"),
  })
  .refine(
    (data) =>
      data.pdfs.reduce((total, pdf) => total + pdf.base64.length, 0) <= MAX_TOTAL_PDF_BASE64,
    { message: "O conjunto de PDFs excede o limite permitido.", path: ["pdfs"] },
  );

function mensagemErroIA(error: unknown) {
  if (error instanceof Error && error.message === AI_OUTPUT_TRUNCATED) {
    return "A geração de um trecho chegou muito perto do limite de saída do modelo e pode estar incompleta. Divida o material e confira o original.";
  }
  const status = (error as { status?: number } | null)?.status;
  return status === 429
    ? "Limite de uso da IA atingido. Aguarde e tente novamente."
    : status === 413
      ? "O material excede o limite aceito pelo serviço. Envie menos páginas ou reduza o texto."
      : "Não foi possível reescrever o material. Tente novamente.";
}

export const reescreverTexto = createServerFn({ method: "POST" })
  .validator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    if (data.material.trim().length < 20 && data.pdfs.length === 0) {
      return { ok: false as const, error: "Cole um texto ou anexe um documento." };
    }

    const request = getRequest() as CloudflareRequest;
    const bindings = request.runtime?.cloudflare?.env;
    const ai = bindings?.AI;
    const rateLimiter = bindings?.AI_RATE_LIMITER;
    if (!ai || !rateLimiter) {
      return {
        ok: false as const,
        error: "A reescrita ainda não está configurada no servidor. Tente novamente mais tarde.",
      };
    }

    try {
      const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
      const allowed = await rateLimiter.limit({ key: `rewrite:${ip}` });
      if (!allowed.success) {
        return {
          ok: false as const,
          error: "Limite temporário atingido: aguarde um minuto antes de iniciar outra reescrita.",
        };
      }
    } catch {
      console.error("Workers rate-limit binding failed");
      return {
        ok: false as const,
        error: "O controle de uso está indisponível. Tente novamente mais tarde.",
      };
    }

    let sourceText = data.material;
    if (data.pdfs.length > 0) {
      try {
        const files = data.pdfs.map((pdf) => {
          const bytes = Uint8Array.from(atob(pdf.base64), (character) => character.charCodeAt(0));
          return { name: pdf.nome, blob: new Blob([bytes], { type: "application/pdf" }) };
        });
        const converted = await ai.toMarkdown(files);
        const extracted = converted.map((result) => {
          if (result.format === "error" || !result.data) {
            throw new Error(`Não foi possível extrair texto de ${result.name}.`);
          }
          return `FONTE: ${result.name}\n${result.data}`;
        });
        sourceText = [sourceText, ...extracted].filter(Boolean).join("\n\n");
      } catch {
        return {
          ok: false as const,
          error:
            "Não foi possível ler um dos PDFs. Verifique o arquivo ou tente um documento menor.",
        };
      }
    }

    if (sourceText.length > MAX_SOURCE_CHARS) {
      return {
        ok: false as const,
        error:
          "O texto extraído ultrapassa o limite de 1.200.000 caracteres. Envie menos páginas ou divida o material.",
      };
    }

    const chunks = splitTextIntoChunks(sourceText, MAX_CHUNK_CHARS);
    if (
      chunks.length > MAX_CHUNK_COUNT ||
      chunks.length + RESERVED_WORKER_SUBREQUESTS > MAX_WORKER_SUBREQUESTS
    ) {
      return {
        ok: false as const,
        error:
          "O material excede a capacidade segura de chamadas. Divida o envio em partes menores.",
      };
    }

    try {
      const rewrittenChunks = await mapWithConcurrency(
        chunks,
        MAX_CHUNK_CONCURRENCY,
        async (chunk, index) => {
          const parts = separateChunkBoundaryFragments(sourceText, chunk);
          if (!parts.core) return parts.prefix + parts.suffix;

          const previousContext = sourceText.slice(
            Math.max(0, chunk.start - MAX_CHUNK_CONTEXT_CHARS),
            chunk.start,
          );
          const nextContext = sourceText.slice(
            chunk.end,
            Math.min(sourceText.length, chunk.end + MAX_CHUNK_CONTEXT_CHARS),
          );
          let completionMarker = `REWRITE_COMPLETE_${crypto.randomUUID()}`;
          while (sourceText.includes(completionMarker)) {
            completionMarker = `REWRITE_COMPLETE_${crypto.randomUUID()}`;
          }
          const messages = buildRewriteMessages({
            source: parts.core,
            focus: data.foco,
            tone: data.tom as RewriteTone,
            previousContext,
            nextContext,
            completionMarker,
            ...(chunks.length > 1 ? { part: { index: index + 1, total: chunks.length } } : {}),
          });
          const response = await ai.run(AI_MODEL, {
            messages,
            max_tokens: MAX_REWRITE_OUTPUT_TOKENS,
            temperature: 0.1,
          });
          if (isLikelyTruncatedAIOutput(response, MAX_REWRITE_OUTPUT_TOKENS)) {
            throw new Error(AI_OUTPUT_TRUNCATED);
          }
          const completedOutput = extractCompletedAIOutput(response.response, completionMarker);
          if (completedOutput === null) throw new Error(AI_OUTPUT_TRUNCATED);
          const rewritten = completedOutput.trim();
          if (!rewritten) throw new Error(`A reescrita da parte ${index + 1} ficou vazia.`);
          return parts.prefix + rewritten + parts.suffix;
        },
      );
      const text = rewrittenChunks.join("");
      if (!text.trim())
        return { ok: false as const, error: "A IA não retornou texto. Tente novamente." };
      return { ok: true as const, text };
    } catch (error) {
      const status = (error as { status?: number } | null)?.status;
      console.error("Workers AI rewrite failed", status ?? "unknown status");
      return { ok: false as const, error: mensagemErroIA(error) };
    }
  });
