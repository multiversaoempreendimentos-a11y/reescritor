# Reescritor de Estudos

Aplicação privada para transformar PDFs e anotações em guias de estudo com foco opcional, explicações em blocos, perguntas de recuperação, gabarito separado, autoavaliação de confiança e reflexão para a próxima revisão.

## O que o app faz

O app recebe texto colado e arquivos PDF, DOCX, TXT ou Markdown; cria um guia completo ou resumo rápido em estilo didático, jurídico ou acadêmico; mantém as perguntas sem respostas até a pessoa indicar sua confiança; e, depois do gabarito, oferece espaço para registrar a sessão e a próxima ação. É possível copiar o guia, baixá-lo como Markdown ou usar a impressão do navegador para salvá-lo em PDF.

As reflexões ficam apenas no `localStorage` do navegador atual, até o limite de 200 registros. Elas não são sincronizadas e não incluem os documentos. A geração é uma ferramenta de estudo, não um serviço para ocultar autoria ou contornar verificações de plágio. Confira citações, legislação e detalhes técnicos nas fontes originais.

## Desenvolvimento local

O projeto usa Bun e o lockfile `bun.lock`.

```bash
bun install --frozen-lockfile
bun run dev
```

Verificações disponíveis:

```bash
bun run test
bun run lint
bun run build
```

## Configuração do servidor

Configure as variáveis no ambiente seguro do provedor de hospedagem. Não as coloque em código, commit ou mensagem:

- `SITE_PASSWORD`: senha de acesso privado ao app.
- `SESSION_SECRET`: segredo aleatório de pelo menos 32 caracteres usado para assinar a sessão.
- O gateway de IA precisa estar habilitado no ambiente Lovable conectado ao projeto.

O arquivo `.env.example` lista somente os nomes dessas variáveis. O app não funciona corretamente sem a configuração dos segredos no servidor. As sessões usam cookie `HttpOnly`, `Secure` e `SameSite=None` para funcionar em prévias HTTPS incorporadas.

## Dados e privacidade

O texto e os documentos são enviados ao gateway de IA quando a pessoa solicita uma geração. O app não salva os materiais-fonte no histórico local. As reflexões ficam apenas no navegador atual; limpar os dados do navegador as apaga. Não há sincronização entre dispositivos nem conta individual nesta implementação.

PDFs são enviados ao gateway como arquivos. DOCX é convertido em texto no navegador antes do envio. O limite atual é de 5 arquivos, até 10 MB por arquivo e 20 MB no total; texto colado e extraído tem limite combinado de 200.000 caracteres.

## Estrutura técnica

TanStack Start e React fornecem a interface e as funções de servidor. O Lovable AI Gateway gera os guias no servidor, e `mammoth` extrai o texto de DOCX no navegador. O acesso privado usa senha, sessão de servidor e proteção CSRF.
