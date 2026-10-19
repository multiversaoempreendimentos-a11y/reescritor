import { useSession } from "@tanstack/react-start/server";

type GateSession = { unlocked?: boolean };

function sessionConfig() {
  const secret = process.env["SESSION_SECRET"];
  if (!secret || secret.length < 32) {
    throw new Error(
      "Configure SESSION_SECRET com pelo menos 32 caracteres no ambiente do servidor.",
    );
  }

  return {
    password: secret,
    name: "reescritor-gate",
    maxAge: 60 * 60 * 24 * 30,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none" as const,
      path: "/",
    },
  };
}

export function useGateSession() {
  return useSession<GateSession>(sessionConfig());
}

export async function isUnlocked() {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- API de sessão por requisição do TanStack Start no servidor.
  const session = await useGateSession();
  return !!session.data.unlocked;
}
