# Roadmap — Reescritor Inteligente

## Implementado no código

- [x] Aplicação pública sem senha, com proteção CSRF e rate limit básico por IP.
- [x] Entrada por texto colado e anexos PDF, DOCX, TXT e Markdown, com até 5 arquivos, 10 MB por arquivo e 20 MB por envio.
- [x] Limite de até 1.200.000 caracteres combinados após extração.
- [x] Reescrita refinada em português do Brasil, com tons refinado, formal, acadêmico e jurídico/técnico e foco editorial opcional.
- [x] Prompt versionado com preservação de significado, estrutura, citações, números, ressalvas e atribuições; o conteúdo-fonte e os contextos laterais são tratados como não confiáveis.
- [x] Divisão em fatias contíguas de até 26.000 caracteres, com fronteiras de palavra preservadas, contexto adjacente, concorrência máxima de 6 e preservação exata dos espaços e fragmentos que não são enviados à IA nas fronteiras.
- [x] Teto conservador de até 48 chamadas de geração, com duas posições reservadas no limite de 50 subrequests para controle de uso e conversão de PDF.
- [x] Marcador aleatório de completude por trecho e leitura de metadados de tokens; uma saída sem confirmação ou próxima do teto não é mostrada como reescrita completa.
- [x] Sessão de texto, opções e resultado de até 250.000 caracteres salvos localmente; chaves extras e bytes de PDF são rejeitados e não serializados.
- [x] Limpeza local invalida operações em andamento; PDFs precisam ser reanexados após recarga.
- [x] Saída pode ser copiada, baixada como `.txt` e impressa/salva como PDF.
- [x] Interface editorial responsiva, com estados acessíveis, suporte a movimento reduzido e sem recursos metacognitivos.
- [x] Testes automatizados de prompt, marcador de completude, armazenamento local, roteamento, concorrência e chunking exato.

## Pendências operacionais

- [x] Executar a nova suíte completa de testes, check, lint e build; 25 testes passaram, sem erros de tipo ou lint (seis avisos preexistentes em componentes-base).
- [x] Revisar a prévia visual em 375, 768, 1280 e 1920 px; confirmar alvos de toque, restauração local, upload acessível e ausência de overflow com nomes longos.
- [ ] Publicar as alterações no branch principal e aguardar o workflow do Cloudflare.
- [ ] Validar no ambiente publicado uma reescrita sintética curta, uma amostra longa autorizada e o tratamento de uma saída sem marcador.
- [ ] Validar conversão de PDF em produção com arquivo de teste autorizado.
- [ ] Confirmar exportação por impressão após o deploy.
- [ ] Monitorar erros de geração em materiais próximos ao limite de 1.200.000 caracteres e ajustar chunking se necessário.
