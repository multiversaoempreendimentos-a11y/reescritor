# Reescritor Inteligente

Aplicação pública de reescrita editorial com IA. Melhora clareza, correção, coesão, fluidez e adequação do tom, mantendo significado, nuances, estrutura, números, citações e referências da fonte.

## O que o app faz

A pessoa pode colar texto ou enviar PDF, DOCX, TXT e Markdown. Escolhe um tom (refinado, formal, acadêmico ou jurídico/técnico) e, se desejar, informa um foco editorial. O resultado é uma reescrita em português do Brasil, que pode ser copiada, baixada como `.txt` ou impressa/salva como PDF.

A aplicação é pública e não exige login ou senha. Não inclui perguntas de recuperação, gabarito, autoavaliação, reflexões nem plano de revisão. O prompt orienta a IA a preservar atribuições e citações e a não produzir texto para ocultar autoria ou contornar verificações de plágio.

## Desenvolvimento local

O projeto usa Bun e o lockfile `bun.lock`.

```bash
bun install --frozen-lockfile
bun run dev
```

Verificações disponíveis:

```bash
bun run test
bun run check
bun run lint
bun run build
```

## Publicação

O deploy é feito pelo workflow manual `Deploy Cloudflare Worker` em GitHub Actions. Cadastre `CLOUDFLARE_API_TOKEN` em Settings → Secrets and variables → Actions → New repository secret. O Account ID usado está configurado no workflow; o token precisa estar autorizado para essa mesma conta. Como o primeiro deploy cria um Worker novo, use um token account-owned com papel `Admin` no produto Workers, limitado à conta correta. Depois da criação inicial, deploys de atualização podem usar `Editor` no Workers. Abra Actions → Deploy Cloudflare Worker → Run workflow. Não envie tokens em chats ou commits. Consulte a [documentação de permissões de Workers](https://developers.cloudflare.com/workers/authorization/) e [deploy com GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).

## Dados e privacidade

A sessão de reescrita — texto colado, foco, tom e resultado de até 250.000 caracteres — é salva somente no `localStorage` do navegador atual; não sincroniza entre aparelhos. O texto extraído de DOCX, TXT e Markdown também pode ser salvo localmente. Se a entrada ou o resultado forem grandes demais para os limites de persistência, o app informa que não conseguiu salvar aquele conteúdo; copie ou baixe a reescrita antes de sair. PDFs são mantidos em memória na página, não são persistidos no navegador e precisam ser anexados novamente após recarregar. O botão de limpeza tenta remover a sessão local e limpa os dados mantidos em memória.

Quando a pessoa solicita uma reescrita, o texto colado e os arquivos são enviados ao Cloudflare Workers AI. DOCX é convertido em texto no navegador; PDFs são convertidos em Markdown no servidor com `AI.toMarkdown`. A aplicação não cria histórico remoto de documentos. O tratamento pelo provedor segue as políticas da Cloudflare.

## Limites e processamento

O limite é de 5 arquivos, até 10 MB por arquivo, 20 MB no total e até 1.200.000 caracteres combinados após a extração e a inclusão dos separadores dos anexos. Materiais acima de 26.000 caracteres são divididos em fatias contíguas de até 26.000 caracteres, processadas com concorrência máxima de 6. A aplicação reescreve as partes na ordem original, preserva os fragmentos de palavra cortados nas fronteiras e não adiciona uma etapa final de resumo. O teto de segurança permite no máximo 48 chamadas de geração e reserva duas posições do limite de 50 subrequests para controle de uso e conversão de PDF.

O app rejeita respostas que não confirmam o marcador técnico de conclusão de cada parte ou que chegam perto do limite de tokens reportado pelo serviço. Isso evita apresentar silenciosamente como completa uma resposta provavelmente interrompida; se ocorrer, divida o material em envios menores. Ainda assim, a ferramenta não valida fatos. Revise especialmente transições entre partes, citações, legislação, números e detalhes técnicos no documento original.

O modelo configurado é `@cf/meta/llama-4-scout-17b-16e-instruct`. O Worker tem um limite básico de 1 reescrita por minuto por endereço IP para reduzir abuso. Esse controle não é um teto global de consumo, pode agrupar usuários pelo IP e não garante limite financeiro. Confira o consumo e as condições atuais no painel Cloudflare; Workers AI pode consumir franquia diária ou gerar custos no plano pago.

## Estrutura técnica

TanStack Start e React fornecem a interface e as funções de servidor. O binding Workers AI gera as reescritas e converte PDFs no servidor; `mammoth` extrai o texto de DOCX no navegador. As funções de servidor mantêm proteção CSRF, e o controle de frequência usa um binding Rate Limiting da Cloudflare.
