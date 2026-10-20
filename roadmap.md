# Roadmap — Reescritor de Estudos

## Implementado no código

- [x] Aplicação pública sem senha, com proteção CSRF e rate limit básico de 1 geração por minuto por IP.
- [x] Anexar PDF, DOCX, TXT e Markdown, com limite de 5 arquivos, 10 MB por arquivo e 20 MB por envio.
- [x] Aceitar até 1.200.000 caracteres combinados após extração.
- [x] Processar fontes com trechos de até 30.000 caracteres, até 6 inferências simultâneas e no máximo 40 sínteses intermediárias antes da síntese final.
- [x] Usar `@cf/meta/llama-4-scout-17b-16e-instruct`, com saída de guia completo ampliada e resumo rápido seletivo.
- [x] Exigir confirmação para textos acima de 300.000 caracteres ou envio de PDF, avisando que pode haver várias inferências, espera e consumo adicional.
- [x] Gerar guia completo ou resumo rápido em estilo didático, jurídico ou acadêmico.
- [x] Manter perguntas sem respostas até a pessoa indicar sua confiança; depois apresentar gabarito, autoavaliação, reflexão e próxima ação.
- [x] Guardar reflexões apenas localmente, com histórico limitado a 200 entradas; copiar, baixar Markdown e imprimir/salvar como PDF.
- [x] Preservar fontes e instruções de integridade acadêmica; não gerar texto para ocultar autoria ou contornar verificações de plágio.
- [x] Adicionar mapa visual das etapas Fonte → Prática → Revisão, mantendo paleta, fontes e layout editorial do produto.

## Pendências de operação

- [ ] Confirmar em produção o binding Workers AI e o rate limiter após o deploy.
- [ ] Testar uma geração sintética curta somente quando houver autorização para consumir Workers AI.
- [ ] Validar conversão de PDFs em produção com arquivo de teste autorizado e verificar o consumo associado.
- [ ] Conferir manualmente em celular a interface publicada e a exportação por impressão.
