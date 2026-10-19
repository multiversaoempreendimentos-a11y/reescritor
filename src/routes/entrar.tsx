import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { unlockSite } from "@/lib/gate.functions";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — Reescritor de Estudos" },
      { name: "description", content: "Acesso privado ao Reescritor de Estudos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Entrar,
});

function Entrar() {
  const router = useRouter();
  const unlock = useServerFn(unlockSite);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setCarregando(true);
    const password = new FormData(event.currentTarget).get("password");

    try {
      const result = await unlock({
        data: { password: typeof password === "string" ? password : "" },
      });
      if (result.ok) await router.navigate({ to: "/" });
      else setErro("Senha incorreta.");
    } catch {
      setErro(
        "Não foi possível validar o acesso. Confira a configuração do servidor e tente novamente.",
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-12">
      <form onSubmit={onSubmit} className="panel w-full max-w-sm">
        <p className="eyebrow">Acesso privado</p>
        <h1 className="font-display text-4xl mt-2 mb-3">
          Reescritor <em className="text-primary">de Estudos</em>
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Entre para transformar seus materiais em sessões de estudo ativo.
        </p>
        <label className="label" htmlFor="password">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={200}
          required
          autoFocus
          className="field"
        />
        {erro && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {erro}
          </p>
        )}
        <button className="cta mt-6 w-full" disabled={carregando}>
          {carregando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
