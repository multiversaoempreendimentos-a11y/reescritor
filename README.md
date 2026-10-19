# Reescritor de Estudos

Aplicação pública para transformar PDFs e anotações em guias de estudo com foco opcional, explicações em blocos, perguntas de recuperação, gabarito separado, autoavaliação de confiança e reflexão para a próxima revisão.

## O que o app faz

O app recebe texto colado e arquivos PDF, DOCX, TXT ou Markdown; cria um guia completo ou resumo rápido em estilo didático, jurídico ou acadêmico; mantém as perguntas sem respostas até a pessoa indicar sua confiança; e, depois do gabarito, oferece espaço para registrar a sessão e a próxima ação. É possível copiar o guia, baixá-lo como Markdown ou usar a impressão do navegador para salvá-lo em PDF. O app não exige login ou senha: qualquer pessoa com o endereço pode usá-lo.

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

## Dados e privacidade

O texto, os DOCX convertidos no navegador e os PDFs convertidos no servidor são enviados ao Cloudflare Workers AI quando a pessoa solicita uma geração. O app não salva os materiais-fonte no histórico local. As reflexões ficam apenas no navegador atual; limpar os dados do navegador as apaga. Não há sincronização entre dispositivos nem conta individual nesta implementação.

PDFs são convertidos em Markdown via `AI.toMarkdown`; DOCX é convertido em texto no navegador. O limite atual é de 5 arquivos, até 10 MB por arquivo, 20 MB no total e até 50.000 caracteres combinados após a extração. O modelo `@cf/meta/llama-3.3-70b-instruct-fp8-fast` tem janela de contexto de 24.000 tokens.

O Worker tem um limite básico de 5 chamadas por minuto por endereço IP para reduzir abuso. É um rate limit local à localização Cloudflare, não um teto global de consumo; o IP pode agrupar usuários legítimos e o controle é eventualmente consistente. Não impede todo abuso nem garante um limite financeiro.

Workers AI inclui 10.000 Neurons por dia sem custo. Em Workers Paid, o uso acima da franquia custa US$ 0,011 por 1.000 Neurons; em Workers Free, novas inferências falham quando o limite diário é excedido. A conversão de PDFs e a geração são processamentos separados. A pessoa deve conferir os limites e o consumo no painel Cloudflare.

## Estrutura técnica

TanStack Start e React fornecem a interface e as funções de servidor. O binding Workers AI gera os guias e converte PDFs no servidor; `mammoth` extrai o texto de DOCX no navegador. As funções de servidor mantêm proteção CSRF, e o controle de frequência usa um binding Rate Limiting da Cloudflare.
