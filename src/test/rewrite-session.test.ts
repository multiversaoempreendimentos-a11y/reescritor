import { describe, expect, it } from "vitest";
import {
  isRewriteSessionSnapshot,
  readRewriteSession,
  removeRewriteSession,
  REWRITE_SESSION_STORAGE_KEY,
  saveRewriteSession,
  type RewriteSessionSnapshot,
} from "@/lib/rewrite-session";

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

const session: RewriteSessionSnapshot = {
  material: "Fonte em português.",
  foco: "Clareza sem perda de nuances.",
  tom: "refinada",
  anexosTexto: [{ nome: "notas.txt", conteudo: "Trecho local do anexo.", bytes: 22 }],
  anexosParaReanexar: ["capitulo.pdf"],
  resultado: "Texto reescrito localmente.",
};

describe("rewrite session storage", () => {
  it("salva e restaura a sessão no armazenamento informado", () => {
    const storage = createStorage();

    expect(saveRewriteSession(storage, session)).toBe(true);
    expect(readRewriteSession(storage)).toEqual(session);
  });

  it("ignora dados inválidos, chaves extras e valores acima dos limites", () => {
    const storage = createStorage({
      [REWRITE_SESSION_STORAGE_KEY]: JSON.stringify({ ...session, tom: "desconhecido" }),
    });

    expect(readRewriteSession(storage)).toBeNull();
    expect(isRewriteSessionSnapshot({ ...session, material: "x".repeat(1_200_001) })).toBe(false);
    expect(isRewriteSessionSnapshot({ ...session, foco: "x".repeat(141) })).toBe(false);
    expect(isRewriteSessionSnapshot({ ...session, resultado: "x".repeat(250_001) })).toBe(false);
    expect(
      isRewriteSessionSnapshot({
        ...session,
        anexosTexto: [{ nome: "x".repeat(301), conteudo: "", bytes: 0 }],
      }),
    ).toBe(false);
    expect(
      isRewriteSessionSnapshot({
        ...session,
        anexosTexto: [{ nome: "capitulo.txt", conteudo: "", bytes: 20 * 1024 * 1024 + 1 }],
      }),
    ).toBe(false);
    expect(isRewriteSessionSnapshot({ ...session, base64: "PDF-PRIVADO" })).toBe(false);
  });

  it("não serializa campos extras que poderiam conter bytes de PDF", () => {
    const storage = createStorage();
    const extended = { ...session, pdfs: [{ nome: "capitulo.pdf", base64: "PDF-PRIVADO" }] };

    expect(saveRewriteSession(storage, extended)).toBe(false);
    expect(storage.values.has(REWRITE_SESSION_STORAGE_KEY)).toBe(false);
    expect(storage.values.get(REWRITE_SESSION_STORAGE_KEY)).toBeUndefined();
    expect(readRewriteSession(storage)).toBeNull();
  });

  it("reporta quota, armazenamento bloqueado e erro de leitura sem lançar exceção", () => {
    const storage = createStorage();
    storage.setItem = () => {
      throw new Error("quota excedida");
    };
    expect(saveRewriteSession(storage, session)).toBe(false);

    const blockedRead = createStorage();
    blockedRead.getItem = () => {
      throw new Error("SecurityError");
    };
    expect(readRewriteSession(blockedRead)).toBeNull();

    const blockedRemove = createStorage();
    blockedRemove.removeItem = () => {
      throw new Error("SecurityError");
    };
    expect(removeRewriteSession(blockedRemove)).toBe(false);
  });

  it("remove somente a sessão de reescrita", () => {
    const storage = createStorage({
      [REWRITE_SESSION_STORAGE_KEY]: JSON.stringify(session),
      "outra-chave": "mantida",
    });

    expect(removeRewriteSession(storage)).toBe(true);
    expect(storage.values.has(REWRITE_SESSION_STORAGE_KEY)).toBe(false);
    expect(storage.values.get("outra-chave")).toBe("mantida");
  });
});
