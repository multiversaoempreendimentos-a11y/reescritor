import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { reescreverTexto } from "@/lib/rewrite.functions";
import {
  MAX_CHUNK_CHARS,
  MAX_LONG_SOURCE_CONFIRM_CHARS,
  MAX_PERSISTED_RESULT_CHARS,
  MAX_SOURCE_CHARS,
} from "@/lib/rewrite-limits";
import {
  readRewriteSession,
  removeRewriteSession,
  saveRewriteSession,
  type RewriteSessionSnapshot,
} from "@/lib/rewrite-session";
import type { RewriteTone } from "@/lib/rewrite-prompt";

type Anexo = { nome: string; tipo: "texto" | "pdf"; conteudo: string; bytes: number };

const MAX_ARQUIVO_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_ARQUIVOS = 5;

async function lerArquivo(file: File): Promise<Anexo> {
  const nome = file.name;
  const extensao = nome.toLowerCase().split(".").pop();

  if (extensao === "pdf") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binario = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return { nome, tipo: "pdf", conteudo: btoa(binario), bytes: file.size };
  }

  if (extensao === "docx") {
    // @ts-expect-error Mammoth fornece este módulo de navegador sem declaração tipada.
    const mammoth = (await import("mammoth/mammoth.browser.js")).default;
    const extraido = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { nome, tipo: "texto", conteudo: extraido.value, bytes: file.size };
  }

  if (extensao === "txt" || extensao === "md") {
    return { nome, tipo: "texto", conteudo: await file.text(), bytes: file.size };
  }

  throw new Error(`Formato não suportado: ${nome}`);
}

function formatarTamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reescritor Inteligente — reescrita fiel e refinada" },
      {
        name: "description",
        content:
          "Reescreva textos com mais clareza, fluidez e precisão, preservando sentido, nuances e referências.",
      },
      { property: "og:title", content: "Reescritor Inteligente" },
      {
        property: "og:description",
        content: "Reescrita editorial em português do Brasil, fiel à fonte.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Index,
});

function Index() {
  const reescrever = useServerFn(reescreverTexto);
  const operacaoAtualRef = useRef(0);
  const [material, setMaterial] = useState("");
  const [foco, setFoco] = useState("");
  const [tom, setTom] = useState<RewriteTone>("refinada");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [anexosParaReanexar, setAnexosParaReanexar] = useState<string[]>([]);
  const [resultado, setResultado] = useState("");
  const [erro, setErro] = useState("");
  const [estadoSessao, setEstadoSessao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [carregandoArquivo, setCarregandoArquivo] = useState(false);
  const [sessaoPronta, setSessaoPronta] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    try {
      const saved = readRewriteSession(window.localStorage);
      if (saved) {
        setMaterial(saved.material);
        setFoco(saved.foco);
        setTom(saved.tom);
        setAnexos(saved.anexosTexto.map((anexo) => ({ ...anexo, tipo: "texto" as const })));
        setAnexosParaReanexar(saved.anexosParaReanexar);
        setResultado(saved.resultado);
      }
    } catch {
      // O app continua utilizável mesmo quando o navegador bloqueia armazenamento local.
    } finally {
      setSessaoPronta(true);
    }
  }, []);

  useEffect(() => {
    if (!sessaoPronta) return;
    const timer = window.setTimeout(() => {
      const anexosTexto = anexos.filter((anexo) => anexo.tipo === "texto");
      const totalCaracteresDeEntrada =
        material.length + anexosTexto.reduce((total, anexo) => total + anexo.conteudo.length, 0);
      const podeSalvarTextos = totalCaracteresDeEntrada <= MAX_SOURCE_CHARS;
      const resultadoPersistido = resultado.length <= MAX_PERSISTED_RESULT_CHARS ? resultado : "";
      const nomesPendentes = Array.from(
        new Set([
          ...anexosParaReanexar,
          ...anexos.filter((anexo) => anexo.tipo === "pdf").map((anexo) => anexo.nome),
          ...(!podeSalvarTextos ? anexosTexto.map((anexo) => anexo.nome) : []),
        ]),
      ).slice(0, MAX_ARQUIVOS);
      const temDados = Boolean(
        material ||
        foco ||
        resultado ||
        anexos.length ||
        nomesPendentes.length ||
        tom !== "refinada",
      );

      try {
        if (!temDados) {
          removeRewriteSession(window.localStorage);
          return;
        }
        const session: RewriteSessionSnapshot = {
          material,
          foco,
          tom,
          anexosTexto: podeSalvarTextos
            ? anexosTexto.map(({ nome, conteudo, bytes }) => ({ nome, conteudo, bytes }))
            : [],
          anexosParaReanexar: nomesPendentes,
          resultado: resultadoPersistido,
        };
        const saved = saveRewriteSession(window.localStorage, session);
        setEstadoSessao(
          saved && resultado.length > MAX_PERSISTED_RESULT_CHARS
            ? "Rascunho salvo neste navegador; a reescrita é longa demais para ser salva automaticamente. Copie ou baixe antes de sair."
            : saved
              ? "Rascunho e resultado salvos somente neste navegador."
              : "O navegador não conseguiu salvar a sessão local; ela permanece disponível até você sair desta página.",
        );
      } catch {
        setEstadoSessao("O armazenamento local está indisponível neste navegador.");
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [material, foco, tom, anexos, anexosParaReanexar, resultado, sessaoPronta]);

  const totalBytes = anexos.reduce((total, anexo) => total + anexo.bytes, 0);
  const anexosTextoParaContagem = anexos.filter((anexo) => anexo.tipo === "texto");
  const partesParaContagem = [
    ...(material.trim() ? [material] : []),
    ...anexosTextoParaContagem.map((anexo) => `[Documento: ${anexo.nome}]\n${anexo.conteudo}`),
  ];
  const totalTextChars =
    partesParaContagem.reduce((total, parte) => total + parte.length, 0) +
    Math.max(0, partesParaContagem.length - 1) * 2;
  const chip = (ativo: boolean) => `chip ${ativo ? "chip-on" : ""}`;

  async function anexar(files: FileList | null) {
    if (!files) return;
    const operationId = ++operacaoAtualRef.current;
    setErro("");
    setCarregandoArquivo(true);
    const novos: Anexo[] = [];
    const avisos: string[] = [];
    let bytesAcumulados = totalBytes;

    try {
      for (const file of Array.from(files)) {
        if (operationId !== operacaoAtualRef.current) return;
        if (anexos.length + novos.length >= MAX_ARQUIVOS) {
          avisos.push(`O limite é de ${MAX_ARQUIVOS} arquivos por envio.`);
          break;
        }
        if (file.size > MAX_ARQUIVO_BYTES) {
          avisos.push(`${file.name} excede 10 MB.`);
          continue;
        }
        if (bytesAcumulados + file.size > MAX_TOTAL_BYTES) {
          avisos.push(`O limite total de anexos é 20 MB; ${file.name} não foi adicionado.`);
          continue;
        }
        try {
          const anexo = await lerArquivo(file);
          if (operationId !== operacaoAtualRef.current) return;
          novos.push(anexo);
          bytesAcumulados += file.size;
        } catch (error) {
          avisos.push(
            error instanceof Error ? error.message : `Não foi possível ler ${file.name}.`,
          );
        }
      }

      if (operationId !== operacaoAtualRef.current) return;
      if (novos.length > 0) {
        setAnexos((anteriores) => [...anteriores, ...novos].slice(0, MAX_ARQUIVOS));
        const nomesNovos = new Set(novos.map((anexo) => anexo.nome));
        setAnexosParaReanexar((anteriores) => anteriores.filter((nome) => !nomesNovos.has(nome)));
      }
      if (avisos.length > 0) setErro(avisos.join(" "));
    } finally {
      if (operationId === operacaoAtualRef.current) setCarregandoArquivo(false);
    }
  }

  function removerAnexo(indice: number) {
    const removido = anexos[indice];
    setAnexos((anteriores) => anteriores.filter((_, i) => i !== indice));
    if (removido) {
      setAnexosParaReanexar((anteriores) => anteriores.filter((nome) => nome !== removido.nome));
    }
  }

  async function enviar() {
    const textos = anexos
      .filter((anexo) => anexo.tipo === "texto")
      .map((anexo) => `[Documento: ${anexo.nome}]\n${anexo.conteudo}`);
    const pdfs = anexos
      .filter((anexo) => anexo.tipo === "pdf")
      .map((anexo) => ({ nome: anexo.nome, base64: anexo.conteudo }));
    const textoCompleto = [material, ...textos]
      .filter((texto) => texto.trim().length > 0)
      .join("\n\n");

    if (textoCompleto.length > MAX_SOURCE_CHARS) {
      setErro(
        "O texto colado e os documentos de texto ultrapassam 1.200.000 caracteres. Remova ou reduza o material.",
      );
      return;
    }
    if (textoCompleto.trim().length < 20 && pdfs.length === 0) {
      setErro(
        textoCompleto.trim()
          ? "O texto precisa ter pelo menos 20 caracteres para ser reescrito."
          : "Cole um texto ou anexe um documento.",
      );
      return;
    }

    if (textoCompleto.length > MAX_LONG_SOURCE_CONFIRM_CHARS || pdfs.length > 0) {
      const estimatedParts = Math.ceil(textoCompleto.length / MAX_CHUNK_CHARS);
      const pdfNotice =
        pdfs.length > 0
          ? " PDFs são convertidos no servidor e o tamanho do texto extraído pode variar."
          : "";
      const confirmed = window.confirm(
        `Este material será reescrito em partes${textoCompleto.length > MAX_LONG_SOURCE_CONFIRM_CHARS ? ` (cerca de ${estimatedParts} partes pelo texto atual)` : ""}. Isso pode levar alguns minutos, usar várias inferências de IA e consumir a franquia diária ou gerar custos no plano pago.${pdfNotice} Quer continuar?`,
      );
      if (!confirmed) return;
    }

    setErro("");
    setResultado("");
    setCopiado(false);
    const operationId = ++operacaoAtualRef.current;
    setCarregando(true);
    try {
      const resposta = await reescrever({
        data: { material: textoCompleto, pdfs, foco, tom },
      });
      if (operationId !== operacaoAtualRef.current) return;
      if (resposta.ok) {
        setResultado(resposta.text);
      } else {
        setErro(resposta.error);
      }
    } catch {
      if (operationId === operacaoAtualRef.current) {
        setErro("Algo deu errado ao reescrever o texto. Tente novamente.");
      }
    } finally {
      if (operationId === operacaoAtualRef.current) setCarregando(false);
    }
  }

  async function copiarReescrita() {
    if (!resultado) return;
    try {
      await navigator.clipboard.writeText(resultado);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1500);
    } catch {
      setErro("Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.");
    }
  }

  function baixarTexto() {
    if (!resultado) return;
    const blob = new Blob([resultado], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "reescrita-refinada.txt";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function limparRascunho() {
    const confirmado = window.confirm(
      "Isso apagará do armazenamento local o texto, os anexos de texto, as opções e a reescrita desta sessão. PDFs precisarão ser reanexados. Quer continuar?",
    );
    if (!confirmado) return;

    operacaoAtualRef.current += 1;
    let removido = false;
    try {
      removido = removeRewriteSession(window.localStorage);
    } catch {
      // Ainda limpa a memória da página quando o navegador bloqueia localStorage.
    }
    setMaterial("");
    setFoco("");
    setTom("refinada");
    setAnexos([]);
    setAnexosParaReanexar([]);
    setResultado("");
    setErro("");
    setCopiado(false);
    setCarregando(false);
    setCarregandoArquivo(false);
    setEstadoSessao(
      removido
        ? "Rascunho e reescrita removidos deste navegador."
        : "A tela foi limpa, mas o armazenamento local não estava acessível para confirmar a remoção.",
    );
  }

  const tons: Array<[RewriteTone, string]> = [
    ["refinada", "Refinada"],
    ["formal", "Formal"],
    ["academica", "Acadêmica"],
    ["juridica", "Jurídica/técnica"],
  ];

  return (
    <main className="min-h-screen px-5 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-9 max-w-4xl">
          <p className="eyebrow">Reescrita editorial com IA</p>
          <h1 className="font-display mt-3 text-5xl leading-[0.98] md:text-7xl">
            Reescritor <em className="text-primary">Inteligente</em>
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
            Dê mais clareza, fluidez e precisão ao seu texto sem perder o sentido, as nuances ou as
            referências da fonte.
          </p>
          <div
            className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground"
            aria-label="Recursos"
          >
            <span className="rounded-full border border-border bg-card px-3 py-2">
              Até 1,2 milhão de caracteres
            </span>
            <span className="rounded-full border border-border bg-card px-3 py-2">
              PDF · Word · TXT · Markdown
            </span>
            <span className="rounded-full border border-border bg-card px-3 py-2">
              Português do Brasil
            </span>
          </div>
        </header>

        <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <form
            className="panel no-print min-w-0"
            onSubmit={(event) => {
              event.preventDefault();
              void enviar();
            }}
          >
            <div className="section-heading">
              <span className="step-index" aria-hidden="true">
                A
              </span>
              <div>
                <p className="eyebrow">Texto de origem</p>
                <h2 className="font-display mt-1 text-2xl text-foreground">Prepare a reescrita</h2>
              </div>
            </div>

            <fieldset className="mb-6">
              <legend className="label">Tom editorial</legend>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Tom editorial">
                {tons.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={chip(tom === value)}
                    aria-pressed={tom === value}
                    disabled={carregando}
                    onClick={() => setTom(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mb-6">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <label className="label mb-0" htmlFor="foco">
                  Foco editorial{" "}
                  <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <span className="text-xs text-muted-foreground">{foco.length}/140</span>
              </div>
              <input
                id="foco"
                className="field"
                value={foco}
                maxLength={140}
                disabled={carregando}
                onChange={(event) => setFoco(event.target.value)}
                placeholder="Ex.: mais clareza, mantendo todos os detalhes essenciais"
              />
            </div>

            <div className="mb-2 flex items-baseline justify-between gap-3">
              <label className="label mb-0" htmlFor="material">
                Texto ou material a reescrever
              </label>
              <span
                className="text-xs text-muted-foreground"
                title="Inclui texto colado e documentos de texto; o conteúdo dos PDFs é contado após a extração."
              >
                {totalTextChars.toLocaleString("pt-BR")}/{MAX_SOURCE_CHARS.toLocaleString("pt-BR")}
              </span>
            </div>
            <textarea
              id="material"
              className="field min-h-56 resize-y"
              value={material}
              maxLength={MAX_SOURCE_CHARS}
              disabled={carregando}
              onChange={(event) => setMaterial(event.target.value)}
              placeholder="Cole aqui o texto que deseja aprimorar. A reescrita preservará o sentido, as ressalvas e as referências disponíveis."
            />

            <label className="dropzone mt-4 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <input
                id="document-upload"
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md,application/pdf,text/plain"
                className="sr-only"
                aria-label="Anexar PDF, Word, TXT ou Markdown"
                aria-describedby="document-upload-help"
                disabled={carregando || carregandoArquivo}
                onChange={(event) => {
                  void anexar(event.target.files);
                  event.target.value = "";
                }}
              />
              <span className="font-semibold">
                {carregandoArquivo ? "Lendo arquivos…" : "Anexar documentos"}
              </span>
              <span id="document-upload-help" className="text-xs text-muted-foreground">
                PDF, Word (.docx), TXT ou Markdown · até 5 arquivos · 10 MB por arquivo · 20 MB no
                total
              </span>
            </label>

            {anexos.length > 0 && (
              <div className="mt-3">
                <ul className="flex w-full min-w-0 flex-wrap gap-2">
                  {anexos.map((anexo, indice) => (
                    <li
                      key={`${anexo.nome}-${indice}`}
                      className="chip flex min-w-0 max-w-full items-center gap-2 overflow-hidden"
                    >
                      <span className="min-w-0 flex-1 truncate">{anexo.nome}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatarTamanho(anexo.bytes)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remover ${anexo.nome}`}
                        className="inline-flex size-11 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive"
                        disabled={carregando || carregandoArquivo}
                        onClick={() => removerAnexo(indice)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Total anexado: {formatarTamanho(totalBytes)}
                </p>
              </div>
            )}

            <div className="mt-5 rounded-lg bg-muted/70 p-3 text-xs leading-5 text-muted-foreground">
              <p className="mb-1 font-semibold text-foreground">Privacidade, integridade e uso</p>
              <p>
                Quando você pede uma reescrita, o texto e os documentos são enviados ao Cloudflare
                Workers AI. Texto colado, texto extraído e resultado ficam no localStorage deste
                navegador, visíveis a quem usa o mesmo perfil. O PDF é mantido em memória nesta
                página e enviado para conversão, mas o arquivo PDF não é salvo no localStorage; será
                preciso anexá-lo novamente após recarregar. Em dispositivos compartilhados, limpe a
                sessão ao terminar. O app não mantém histórico remoto; o tratamento pelo provedor
                segue as políticas da Cloudflare. O limite por IP não é um teto global de consumo:
                materiais longos podem usar várias inferências e consumir franquia ou gerar custos.
                Use somente materiais que você pode processar. O app preserva citações e atribuições
                e não foi feito para ocultar autoria ou contornar verificações de plágio.
              </p>
            </div>

            {anexosParaReanexar.length > 0 && (
              <div
                className="mt-3 rounded-lg border border-border bg-background p-3 text-xs leading-5"
                role="status"
              >
                <p className="font-semibold">Anexos que precisarão ser enviados novamente</p>
                <ul className="mt-1 space-y-1 text-muted-foreground">
                  {anexosParaReanexar.map((nome) => (
                    <li key={nome} className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 flex-1 break-all">{nome}</span>
                      <button
                        type="button"
                        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:text-destructive"
                        aria-label={`Dispensar aviso do anexo ${nome}`}
                        onClick={() =>
                          setAnexosParaReanexar((anteriores) =>
                            anteriores.filter((anterior) => anterior !== nome),
                          )
                        }
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-muted-foreground">
                  PDFs e arquivos de texto grandes não ficam guardados no armazenamento local.
                </p>
              </div>
            )}

            {erro && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {erro}
              </p>
            )}
            {estadoSessao && (
              <p className="mt-3 text-xs text-muted-foreground" role="status">
                {estadoSessao}
              </p>
            )}

            <button
              className="cta mt-5 w-full"
              type="submit"
              disabled={carregando || carregandoArquivo}
            >
              {carregando
                ? totalTextChars > MAX_CHUNK_CHARS || anexos.length > 0
                  ? "Reescrevendo em partes — pode levar alguns minutos…"
                  : "Preparando a reescrita…"
                : "Reescrever texto"}
            </button>
            <button
              className="mt-3 min-h-11 w-full rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground"
              type="button"
              onClick={limparRascunho}
            >
              Limpar rascunho e resultado deste navegador
            </button>
          </form>

          <section
            id="rewrite-output"
            className="panel panel-paper min-h-[32rem] min-w-0"
            aria-labelledby="output-title"
            aria-busy={carregando}
          >
            <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Resultado</p>
                <h2 id="output-title" className="font-display mt-1 text-2xl text-foreground">
                  Reescrita refinada
                </h2>
              </div>
              {resultado && (
                <div className="flex flex-wrap gap-2">
                  <button className="chip" type="button" onClick={copiarReescrita}>
                    {copiado ? "Copiado" : "Copiar"}
                  </button>
                  <button className="chip" type="button" onClick={baixarTexto}>
                    Baixar .txt
                  </button>
                  <button className="chip" type="button" onClick={() => window.print()}>
                    Salvar como PDF
                  </button>
                </div>
              )}
            </div>

            <p className="sr-only" role="status" aria-live="polite">
              {carregando
                ? "A reescrita está sendo preparada."
                : resultado
                  ? "Reescrita pronta."
                  : ""}
            </p>
            {carregando ? (
              <div className="space-y-4 animate-pulse" aria-hidden="true">
                {[92, 75, 88, 65, 82, 70].map((width, index) => (
                  <div
                    key={index}
                    className="h-3 rounded bg-muted"
                    style={{ width: `${width}%` }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            ) : resultado ? (
              <article className="rewrite-output">{resultado}</article>
            ) : (
              <div className="empty-output">
                <span className="empty-output-index" aria-hidden="true">
                  B
                </span>
                <p className="font-display text-3xl text-foreground">
                  Sua reescrita aparecerá aqui.
                </p>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Envie um texto, ajuste o tom se quiser e receba uma versão mais clara e fluida,
                  preservando as informações e as referências da fonte.
                </p>
              </div>
            )}
          </section>
        </div>

        <p className="no-print mt-8 max-w-3xl text-xs leading-5 text-muted-foreground">
          A ferramenta revisa a forma, não valida os fatos. Confira citações, legislação, números e
          detalhes técnicos no material original antes de reutilizar a reescrita.
        </p>
      </div>
    </main>
  );
}
