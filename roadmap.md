# Roadmap — Reescritor de Estudos

## Implementado no código

- [x] Aplicação sem senha; mantém proteção CSRF e rate limit básico de 5 gerações por minuto por IP.
- [x] Anexar PDF, DOCX, TXT e Markdown, com limites por arquivo e por envio.
- [x] Gerar guia completo ou resumo rápido com Cloudflare Workers AI.
- [x] Converter PDFs no servidor com Workers AI `toMarkdown`, respeitando limite combinado de fonte.
- [x] Foco de estudo opcional, limitado a 140 caracteres.
- [x] Conteúdo organizado em blocos, perguntas de recuperação e gabarito protegido por marcadores.
- [x] Solicitar uma autoavaliação de confiança antes de revelar o gabarito.
- [x] Reflexão pós-estudo com objetivo, confiança e próximo passo; histórico local limitado a 200 entradas.
- [x] Copiar ou baixar Markdown e imprimir/salvar o material visível como PDF.
- [x] Instruções de integridade acadêmica e preservação de referências às fontes.

## A validar na hospedagem Cloudflare Workers

- [ ] Confirmar o binding `AI` do Workers AI no Worker publicado.
- [ ] Confirmar binding de rate limiting e funcionamento do limite básico.
- [ ] Testar geração e conversão de PDF ponta a ponta com material sintético autorizado.
- [ ] Conferir upload de PDF e DOCX em desktop e celular, além da exportação por impressão.
- [ ] Verificar a prévia HTTPS incorporada e o cookie da sessão após login.
