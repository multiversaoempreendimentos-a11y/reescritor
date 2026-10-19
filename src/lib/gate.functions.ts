import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";

async function sha(s: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}

async function matches(input: string, expected: string) {
  const [a, b] = await Promise.all([sha(input), sha(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 1);
  return diff === 0;
}

export const requireAccess = createServerFn({ method: "GET" }).handler(async () => {
  if (!(await (await import("./gate.server")).isUnlocked())) throw redirect({ to: "/entrar" });
  return { ok: true };
});

export const unlockSite = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ password: z.string().max(200) }).parse(data))
  .handler(async ({ data }) => {
    const expected = process.env["SITE_PASSWORD"];
    if (!expected) throw new Error("SITE_PASSWORD não configurada");
    if (!(await matches(data.password, expected))) return { ok: false as const };
    const s = await (await import("./gate.server")).useGateSession();
    await s.update({ unlocked: true });
    return { ok: true as const };
  });

export const lockSite = createServerFn({ method: "POST" }).handler(async () => {
  const s = await (await import("./gate.server")).useGateSession();
  await s.clear();
  return { ok: true as const };
});
