# Automações do Noxvellox

Abra a aba [GitHub Actions](https://github.com/josefut200-blip/noxvellox/actions) para acompanhar e iniciar as automações. As que aceitam execução manual mostram o botão **Run workflow** ao abrir a página da automação.

| Automação | O que faz | Quando roda | Abrir |
| --- | --- | --- | --- |
| Auditor de embeds oficiais | Confere os embeds da lista de canais parceiros. Remove somente vídeo com bloqueio externo explícito ou resposta 404/410. Casos inconclusivos ficam no relatório da execução. | Semanalmente e manualmente | [Audit official video embeds](https://github.com/josefut200-blip/noxvellox/actions/workflows/audit-official-embeds.yml) |
| Verificador de imagens dos banners | Confere se os banners têm imagens válidas e se o fallback visual está presente. | Diariamente, em mudanças relacionadas e manualmente | [Banner image guardian](https://github.com/josefut200-blip/noxvellox/actions/workflows/banner-image-guardian.yml) |
| Sincronizador de canais parceiros | Atualiza a lista de parceiros, os vídeos vinculados e os dados visuais dos perfis. | Diariamente e manualmente | [Sync partner directory](https://github.com/josefut200-blip/noxvellox/actions/workflows/sync-partners.yml) |
| Atualizador de feed autorizado | Busca metadados de uma fonte configurada e atualiza o catálogo local. Preserva a última cópia válida quando a fonte falha. | A cada seis horas e manualmente | [Update authorized video feed](https://github.com/josefut200-blip/noxvellox/actions/workflows/update-feed.yml) |

## Onde fica o código

- Auditor de embeds — `scripts/audit-official-embeds.mjs`
- Verificador de banners — `scripts/check-banner-images.mjs`
- Sincronização de parceiros — `scripts/sync-partners.py`, `scripts/sync-partner-videos.py` e `scripts/sync-partner-profiles.mjs`
- Atualização do feed — `scripts/fetch-feed.js`

Os horários do GitHub Actions são configurados em UTC. Uma execução manual é iniciada dentro do workflow correspondente, na aba Actions.
