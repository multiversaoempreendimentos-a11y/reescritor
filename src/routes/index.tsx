import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { gerarTexto } from "@/lib/rewrite.functions";
import { requireAccess, lockSite } from "@/lib/gate.functions";
import {
  classifySelfAssessment,
  parseStudyGuide,
  type Confidence,
  type SelfAssessment,
} from "@/lib/study-guide-utils";

type Anexo = { nome: string; tipo: "texto" | "pdf"; conteudo: string; bytes: number };
type Formato = "guia" | "resumo";
type Estilo = "didatico" | "juridico" | "academico";
type Reflexao = {
  id: string;
  data: string;
  objetivo: string;
  confianca: Confidence;
  resultado: SelfAssessment | "";
  objetivoStatus: string;
  funcionou: string;
  proximoPasso: string;
};

const MAX_ARQUIVO_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_ARQUIVOS = 5;
const MAX_TEXTO = 50_000;
const CHAVE_REFLEXOES = "reescritor.reflexoes.v1";

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
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;
}

function ehReflexao(value: unknown): value is Reflexao {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Reflexao>;
  return (
    typeof item.id === "string" &&
    typeof item.data === "string" &&
    typeof item.objetivo === "string" &&
    typeof item.funcionou === "string" &&
    typeof item.proximoPasso === "string"
  );
}

export const Route = createFileRoute("/")({
  loader: () => requireAccess(),
  head: () => ({
    meta: [
      { title: "Reescritor de Estudos — estudo ativo com IA" },
      {
        name: "description",
        content:
          "Transforme PDFs e anotações em guias de estudo, perguntas de recuperação e planos de revisão.",
      },
      { property: "og:title", content: "Reescritor de Estudos" },
      {
        property: "og:description",
        content: "Guias de estudo com recuperação ativa, autoavaliação e revisão.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Index,
});

function Index() {
  const gerar = useServerFn(gerarTexto);
  const sair = useServerFn(lockSite);
  const router = useRouter();
  const [material, setMaterial] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [formato, setFormato] = useState<Formato>("guia");
  const [estilo, setEstilo] = useState<Estilo>("didatico");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [resultado, setResultado] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [carregandoArquivo, setCarregandoArquivo] = useState(false);
  const [confianca, setConfianca] = useState<Confidence | null>(null);
  const [gabaritoVisivel, setGabaritoVisivel] = useState(false);
  const [resultadoPessoal, setResultadoPessoal] = useState<SelfAssessment | null>(null);
  const [objetivoStatus, setObjetivoStatus] = useState("");
  const [funcionou, setFuncionou] = useState("");
  const [proximoPasso, setProximoPasso] = useState("");
  const [reflexoes, setReflexoes] = useState<Reflexao[]>([]);
  const [reflexaoSalva, setReflexaoSalva] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHAVE_REFLEXOES);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) setReflexoes(parsed.filter(ehReflexao).slice(0, 200));
    } catch {
      setReflexoes([]);
    }
  }, []);

  const partes = resultado ? parseStudyGuide(resultado) : null;
  const totalBytes = anexos.reduce((total, anexo) => total + anexo.bytes, 0);
  const guiaVisivel = partes
    ? [partes.antes, gabaritoVisivel ? partes.gabarito : "", partes.depois]
        .filter(Boolean)
        .join("\n\n")
    : "";
  const chip = (ativo: boolean) => `chip ${ativo ? "chip-on" : ""}`;

  async function anexar(files: FileList | null) {
    if (!files) return;
    setErro("");
    setCarregandoArquivo(true);
    const novos: Anexo[] = [];
    const avisos: string[] = [];
    let bytesAcumulados = totalBytes;

    for (const file of Array.from(files)) {
      if (anexos.length + novos.length >= MAX_ARQUIVOS) {
        avisos.push(`O limite é de ${MAX_ARQUIVOS} arquivos por guia.`);
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
        novos.push(anexo);
        bytesAcumulados += file.size;
      } catch (error) {
        avisos.push(error instanceof Error ? error.message : `Não foi possível ler ${file.name}.`);
      }
    }

    if (novos.length > 0)
      setAnexos((anteriores) => [...anteriores, ...novos].slice(0, MAX_ARQUIVOS));
    if (avisos.length > 0) setErro(avisos.join(" "));
    setCarregandoArquivo(false);
  }

  function removerAnexo(indice: number) {
    setAnexos((anteriores) => anteriores.filter((_, i) => i !== indice));
  }

  function limparSessao() {
    setResultado("");
    setConfianca(null);
    setGabaritoVisivel(false);
    setResultadoPessoal(null);
    setObjetivoStatus("");
    setFuncionou("");
    setProximoPasso("");
    setReflexaoSalva(false);
    setErro("");
  }

  async function enviar() {
    setErro("");
    limparSessao();
    const textos = anexos
      .filter((anexo) => anexo.tipo === "texto")
      .map((anexo) => `[Documento: ${anexo.nome}]\n${anexo.conteudo}`);
    const pdfs = anexos
      .filter((anexo) => anexo.tipo === "pdf")
      .map((anexo) => ({ nome: anexo.nome, base64: anexo.conteudo }));
    const textoCompleto = [material.trim(), ...textos].filter(Boolean).join("\n\n");

    if (textoCompleto.length > MAX_TEXTO) {
      setErro(
        "O texto colado e os documentos de texto ultrapassam 50.000 caracteres. Remova ou reduza o material.",
      );
      return;
    }
    if (textoCompleto.trim().length < 20 && pdfs.length === 0) {
      setErro("Cole um texto ou anexe um documento.");
      return;
    }

    setCarregando(true);
    try {
      const resposta = await gerar({
        data: { material: textoCompleto, pdfs, objetivo, formato, estilo },
      });
      if (resposta.ok) {
        if (!parseStudyGuide(resposta.text)) {
          setErro("A resposta não separou o gabarito com segurança. Tente gerar novamente.");
        } else {
          setResultado(resposta.text);
        }
      } else {
        setErro(resposta.error);
      }
    } catch {
      setErro("Algo deu errado ao gerar o guia. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function copiarGuia() {
    if (!guiaVisivel) return;
    try {
      await navigator.clipboard.writeText(guiaVisivel);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1500);
    } catch {
      setErro(
        "Não foi possível copiar automaticamente. Selecione o texto do guia e copie manualmente.",
      );
    }
  }

  function baixarMarkdown() {
    if (!guiaVisivel) return;
    const blob = new Blob([guiaVisivel], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "guia-de-estudo.md";
    link.click();
    URL.revokeObjectURL(url);
  }

  function salvarReflexao() {
    if (!confianca) return;
    if (!objetivoStatus && !funcionou.trim() && !proximoPasso.trim()) {
      setErro("Preencha ao menos uma resposta da reflexão antes de salvar.");
      return;
    }

    const nova: Reflexao = {
      id: crypto.randomUUID(),
      data: new Date().toISOString(),
      objetivo: objetivo.trim(),
      confianca,
      resultado: resultadoPessoal ?? "",
      objetivoStatus,
      funcionou: funcionou.trim(),
      proximoPasso: proximoPasso.trim(),
    };
    const atualizadas = [nova, ...reflexoes].slice(0, 200);
    try {
      window.localStorage.setItem(CHAVE_REFLEXOES, JSON.stringify(atualizadas));
      setReflexoes(atualizadas);
      setReflexaoSalva(true);
      setErro("");
    } catch {
      setErro(
        "Não foi possível guardar a reflexão neste navegador. Você ainda pode copiar suas anotações.",
      );
    }
  }

  async function encerrar() {
    await sair();
    await router.navigate({ to: "/entrar" });
  }

  const confiancas: Array<[Confidence, string]> = [
    ["chutei", "Chutei"],
    ["acho", "Acho"],
    ["certeza", "Tenho certeza"],
  ];
  const autoavaliacoes: Array<[SelfAssessment, string]> = [
    ["maioria", "Acertei a maior parte"],
    ["misto", "Tive acertos e dúvidas"],
    ["dificuldade", "Errei em pontos importantes"],
  ];

  return (
    <main className="min-h-screen px-5 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="no-print mb-8 flex justify-end">
          <button className="chip" onClick={encerrar}>
            Sair
          </button>
        </div>

        <header className="mb-10 max-w-3xl no-print">
          <p className="eyebrow">Estudo ativo com IA</p>
          <h1 className="font-display mt-3 text-5xl leading-[0.98] md:text-7xl">
            Reescritor <em className="text-primary">de Estudos</em>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Envie um material, escolha um foco e transforme as fontes em blocos de aprendizagem,
            perguntas para recuperar sem consulta e um plano de revisão.
          </p>
        </header>

        <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="panel no-print">
            <div className="mb-6">
              <label className="label">Formato de estudo</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={chip(formato === "guia")}
                  onClick={() => setFormato("guia")}
                >
                  Guia completo
                </button>
                <button
                  type="button"
                  className={chip(formato === "resumo")}
                  onClick={() => setFormato("resumo")}
                >
                  Resumo rápido
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="label">Estilo de explicação</label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["didatico", "Didático"],
                    ["juridico", "Jurídico"],
                    ["academico", "Acadêmico"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={chip(estilo === value)}
                    onClick={() => setEstilo(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <label className="label mb-0" htmlFor="objetivo">
                  Foco da sessão{" "}
                  <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <span className="text-xs text-muted-foreground">{objetivo.length}/140</span>
              </div>
              <input
                id="objetivo"
                className="field"
                value={objetivo}
                maxLength={140}
                onChange={(event) => setObjetivo(event.target.value)}
                placeholder="Ex.: explicar as diferenças entre prescrição e decadência"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Escreva um resultado que consiga testar sem consultar. Você pode deixar em branco e
                seguir direto.
              </p>
            </div>

            <div className="mb-2 flex items-baseline justify-between gap-3">
              <label className="label mb-0" htmlFor="material">
                Material de estudo
              </label>
              <span className="text-xs text-muted-foreground">
                {material.length.toLocaleString("pt-BR")}/50.000
              </span>
            </div>
            <textarea
              id="material"
              className="field min-h-56 resize-y"
              value={material}
              maxLength={MAX_TEXTO}
              onChange={(event) => setMaterial(event.target.value)}
              placeholder="Cole trechos ou anotações que você tem autorização para estudar. A síntese manterá as referências disponíveis."
            />

            <label className="dropzone mt-4">
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md,application/pdf,text/plain"
                className="sr-only"
                disabled={carregandoArquivo}
                onChange={(event) => {
                  void anexar(event.target.files);
                  event.target.value = "";
                }}
              />
              <span className="font-semibold">
                {carregandoArquivo ? "Lendo arquivos…" : "Anexar documentos"}
              </span>
              <span className="text-xs text-muted-foreground">
                PDF, Word (.docx), TXT ou Markdown · até 5 arquivos · 10 MB por arquivo · 20 MB no
                total
              </span>
            </label>

            {anexos.length > 0 && (
              <div className="mt-3">
                <ul className="flex flex-wrap gap-2">
                  {anexos.map((anexo, indice) => (
                    <li key={`${anexo.nome}-${indice}`} className="chip flex items-center gap-2">
                      <span className="max-w-52 truncate">{anexo.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatarTamanho(anexo.bytes)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remover ${anexo.nome}`}
                        className="text-muted-foreground hover:text-destructive"
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

            <p className="mt-4 rounded-lg bg-muted/70 p-3 text-xs leading-5 text-muted-foreground">
              O material enviado é processado pelo Cloudflare Workers AI quando você solicita uma
              geração; PDFs são convertidos em texto no serviço. A Cloudflare oferece 10.000 Neurons
              por dia sem custo; em plano Workers Paid, o excedente custa US$ 0,011 por 1.000
              Neurons. Use apenas arquivos que você pode compartilhar para esse fim. Confira
              conceitos e referências nas fontes; o resultado não é feito para ocultar autoria ou
              contornar verificações de plágio.
            </p>

            {erro && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {erro}
              </p>
            )}
            <button
              className="cta mt-5 w-full"
              onClick={enviar}
              disabled={carregando || carregandoArquivo}
            >
              {carregando
                ? "Preparando seu guia…"
                : formato === "guia"
                  ? "Criar guia de estudo"
                  : "Criar resumo para revisar"}
            </button>
          </section>

          <section id="study-guide" className="panel panel-paper min-h-[32rem]" aria-live="polite">
            <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
              <span className="label mb-0">Seu material de estudo</span>
              {partes && (
                <div className="flex flex-wrap gap-2">
                  <button className="chip" onClick={copiarGuia}>
                    {copiado ? "Copiado" : "Copiar"}
                  </button>
                  <button className="chip" onClick={baixarMarkdown}>
                    Baixar .md
                  </button>
                  <button className="chip" onClick={() => window.print()}>
                    Salvar como PDF
                  </button>
                </div>
              )}
            </div>

            {carregando ? (
              <div className="space-y-4 animate-pulse" aria-label="Gerando guia">
                {[92, 75, 88, 65, 82, 70].map((width, index) => (
                  <div
                    key={index}
                    className="h-3 rounded bg-muted"
                    style={{ width: `${width}%` }}
                  />
                ))}
              </div>
            ) : partes ? (
              <>
                <article className="study-output">{partes.antes}</article>
                {partes.depois && <article className="study-output mt-6">{partes.depois}</article>}

                <div className="no-print mt-7 border-t border-border pt-5">
                  {!gabaritoVisivel ? (
                    <>
                      <p className="label">
                        Antes de conferir: como você avalia sua confiança nas respostas?
                      </p>
                      <div
                        className="mb-4 flex flex-wrap gap-2"
                        role="group"
                        aria-label="Autoavaliação de confiança"
                      >
                        {confiancas.map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={chip(confianca === value)}
                            onClick={() => setConfianca(value)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <button
                        className="cta"
                        disabled={!confianca}
                        onClick={() => setGabaritoVisivel(true)}
                      >
                        Marque sua confiança para revelar o gabarito
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="mb-5 rounded-xl border border-border bg-card p-5">
                        <h2 className="mb-3 font-display text-2xl text-primary">
                          Gabarito comentado
                        </h2>
                        <article className="study-output">{partes.gabarito}</article>
                      </div>

                      <div className="rounded-xl border border-border bg-card p-5">
                        <h2 className="font-display text-2xl text-primary">
                          Feche a sessão com uma reflexão
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Compare sua confiança geral com o que percebeu ao conferir. Esta é uma
                          autoavaliação, não uma correção automática.
                        </p>

                        <fieldset className="mt-5">
                          <legend className="label">Como foi em relação ao gabarito?</legend>
                          <div className="flex flex-wrap gap-2">
                            {autoavaliacoes.map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                className={chip(resultadoPessoal === value)}
                                onClick={() => {
                                  setResultadoPessoal(value);
                                  setReflexaoSalva(false);
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </fieldset>

                        {confianca && resultadoPessoal && (
                          <p className="mt-4 rounded-lg bg-muted/70 p-3 text-sm">
                            Padrão percebido:{" "}
                            <strong>{classifySelfAssessment(confianca, resultadoPessoal)}</strong>.
                            Use isso para decidir o que revisar; não é uma medida validada de
                            domínio ou calibração.
                          </p>
                        )}

                        <fieldset className="mt-5">
                          <legend className="label">Você cumpriu o foco desta sessão?</legend>
                          <div className="flex flex-wrap gap-2">
                            {["Sim", "Parcialmente", "Ainda não"].map((value) => (
                              <button
                                key={value}
                                type="button"
                                className={chip(objetivoStatus === value)}
                                onClick={() => {
                                  setObjetivoStatus(value);
                                  setReflexaoSalva(false);
                                }}
                              >
                                {value}
                              </button>
                            ))}
                          </div>
                        </fieldset>

                        <label className="label mt-5" htmlFor="funcionou">
                          O que funcionou ou o que ainda confunde?{" "}
                          <span className="font-normal text-muted-foreground">(opcional)</span>
                        </label>
                        <textarea
                          id="funcionou"
                          className="field min-h-24 resize-y"
                          maxLength={400}
                          value={funcionou}
                          onChange={(event) => {
                            setFuncionou(event.target.value);
                            setReflexaoSalva(false);
                          }}
                        />
                        <div className="mb-4 mt-1 text-right text-xs text-muted-foreground">
                          {funcionou.length}/400
                        </div>

                        <label className="label" htmlFor="proximo-passo">
                          Qual ação concreta fará na próxima revisão?{" "}
                          <span className="font-normal text-muted-foreground">(opcional)</span>
                        </label>
                        <textarea
                          id="proximo-passo"
                          className="field min-h-24 resize-y"
                          maxLength={400}
                          value={proximoPasso}
                          onChange={(event) => {
                            setProximoPasso(event.target.value);
                            setReflexaoSalva(false);
                          }}
                          placeholder="Ex.: explicar em voz alta a diferença entre os dois conceitos que confundi."
                        />
                        <div className="mb-4 mt-1 text-right text-xs text-muted-foreground">
                          {proximoPasso.length}/400
                        </div>

                        <button className="cta" onClick={salvarReflexao} disabled={reflexaoSalva}>
                          Guardar reflexão neste navegador
                        </button>
                        {reflexaoSalva && (
                          <p className="mt-3 text-sm text-muted-foreground">
                            Reflexão guardada localmente. Ela não é sincronizada e não inclui o
                            material enviado.
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="max-w-xl py-8">
                <p className="font-display text-2xl text-muted-foreground">
                  Seu guia aparecerá aqui.
                </p>
                <ol className="mt-5 space-y-3 text-sm leading-6 text-muted-foreground">
                  <li>
                    <strong>1. Escolha um foco</strong> — ou pule, pois o campo é opcional.
                  </li>
                  <li>
                    <strong>2. Estude em blocos</strong> — entenda as explicações e tente responder
                    às perguntas sem consultar.
                  </li>
                  <li>
                    <strong>3. Registre sua confiança</strong> antes de revelar o gabarito
                    comentado.
                  </li>
                  <li>
                    <strong>4. Reflita e planeje</strong> uma ação específica para a próxima
                    revisão.
                  </li>
                </ol>
              </div>
            )}
          </section>
        </div>

        {reflexoes.length > 0 && (
          <details className="no-print panel mt-7">
            <summary className="cursor-pointer font-semibold">
              Reflexões recentes salvas neste navegador ({reflexoes.length}; máximo 200)
            </summary>
            <ul className="mt-4 divide-y divide-border">
              {reflexoes.slice(0, 5).map((reflexao) => (
                <li key={reflexao.id} className="py-3">
                  <p className="text-xs text-muted-foreground">
                    {new Date(reflexao.data).toLocaleString("pt-BR")}
                  </p>
                  <p className="mt-1 font-semibold">
                    {reflexao.objetivo || "Sessão sem foco definido"}
                  </p>
                  {reflexao.proximoPasso && (
                    <p className="mt-1 text-sm">Próximo passo: {reflexao.proximoPasso}</p>
                  )}
                  {reflexao.funcionou && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Reflexão: {reflexao.funcionou}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Esses registros ficam apenas neste navegador; não contêm os documentos nem sincronizam
              entre aparelhos.
            </p>
          </details>
        )}

        <p className="no-print mt-8 max-w-3xl text-xs leading-5 text-muted-foreground">
          A recuperação ativa ajuda a testar o que você consegue explicar sem consulta; ela não
          garante retenção nem substitui a fonte. Revise citações, legislação e detalhes técnicos no
          documento original.
        </p>
      </div>
    </main>
  );
}
