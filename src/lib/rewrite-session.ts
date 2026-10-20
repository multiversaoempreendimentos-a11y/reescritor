import { MAX_PERSISTED_RESULT_CHARS, MAX_SOURCE_CHARS } from "./rewrite-limits";
import type { RewriteTone } from "./rewrite-prompt";

export const REWRITE_SESSION_STORAGE_KEY = "reescritor.reescrita.v1";

export type StoredRewriteAttachment = {
  nome: string;
  conteudo: string;
  bytes: number;
};

export type RewriteSessionSnapshot = {
  material: string;
  foco: string;
  tom: RewriteTone;
  anexosTexto: StoredRewriteAttachment[];
  anexosParaReanexar: string[];
  resultado: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const tons: readonly RewriteTone[] = ["refinada", "formal", "academica", "juridica"];
const camposPermitidos = new Set([
  "material",
  "foco",
  "tom",
  "anexosTexto",
  "anexosParaReanexar",
  "resultado",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isRewriteSessionSnapshot(value: unknown): value is RewriteSessionSnapshot {
  if (!isRecord(value) || Object.keys(value).some((key) => !camposPermitidos.has(key)))
    return false;

  const material = value["material"];
  const foco = value["foco"];
  const tom = value["tom"];
  const anexosTexto = value["anexosTexto"];
  const anexosParaReanexar = value["anexosParaReanexar"];
  const resultado = value["resultado"];
  const caracteresDeEntrada =
    typeof material === "string"
      ? material.length +
        (Array.isArray(anexosTexto)
          ? anexosTexto.reduce((total, item) => {
              if (!isRecord(item)) return total;
              const conteudo = item["conteudo"];
              return total + (typeof conteudo === "string" ? conteudo.length : 0);
            }, 0)
          : 0)
      : Number.POSITIVE_INFINITY;

  return (
    typeof material === "string" &&
    typeof foco === "string" &&
    foco.length <= 140 &&
    tons.includes(tom as RewriteTone) &&
    Array.isArray(anexosTexto) &&
    anexosTexto.length <= 5 &&
    anexosTexto.every((item) => {
      if (
        !isRecord(item) ||
        Object.keys(item).some((key) => !["nome", "conteudo", "bytes"].includes(key))
      ) {
        return false;
      }
      const nome = item["nome"];
      const conteudo = item["conteudo"];
      const bytes = item["bytes"];
      return (
        typeof nome === "string" &&
        nome.length <= 300 &&
        typeof conteudo === "string" &&
        typeof bytes === "number" &&
        Number.isFinite(bytes) &&
        bytes >= 0 &&
        bytes <= 20 * 1024 * 1024
      );
    }) &&
    Array.isArray(anexosParaReanexar) &&
    anexosParaReanexar.length <= 5 &&
    anexosParaReanexar.every((name) => typeof name === "string" && name.length <= 300) &&
    caracteresDeEntrada <= MAX_SOURCE_CHARS &&
    typeof resultado === "string" &&
    resultado.length <= MAX_PERSISTED_RESULT_CHARS
  );
}

export function readRewriteSession(storage: StorageLike): RewriteSessionSnapshot | null {
  try {
    const raw = storage.getItem(REWRITE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isRewriteSessionSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveRewriteSession(storage: StorageLike, session: RewriteSessionSnapshot): boolean {
  try {
    if (!isRewriteSessionSnapshot(session)) return false;
    const safeSnapshot: RewriteSessionSnapshot = {
      material: session.material,
      foco: session.foco,
      tom: session.tom,
      anexosTexto: session.anexosTexto.map(({ nome, conteudo, bytes }) => ({
        nome,
        conteudo,
        bytes,
      })),
      anexosParaReanexar: [...session.anexosParaReanexar],
      resultado: session.resultado,
    };
    storage.setItem(REWRITE_SESSION_STORAGE_KEY, JSON.stringify(safeSnapshot));
    return true;
  } catch {
    return false;
  }
}

export function removeRewriteSession(storage: StorageLike): boolean {
  try {
    storage.removeItem(REWRITE_SESSION_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
