# NOXVELLOX v0.2.7 - mais de 50 embeds oficiais + novas publicações automáticas

[![NexusBro QA Score](https://nexusbro.com/api/badge/noxvellox.pages.dev)](https://nexusbro.com/scores/noxvellox.pages.dev?source=badge&utm_source=score_badge&utm_medium=readme)

## O que muda

- Atualização automática do feed autorizado a cada seis horas por GitHub Actions.
- O snapshot anterior é preservado quando a fonte retorna erro, bloqueio ou dados inválidos.
- O site lê o catálogo local em `public/data/videos.json`, evitando fetch ao vivo durante a navegação.
- O sitemap usa URLs limpas e inclui somente registros válidos.

## Limites e segurança

O workflow não baixa, hospeda, copia ou reencoda vídeos. Ele aceita apenas metadados e incorporações de fontes oficiais autorizadas. A disponibilidade do provedor pode mudar; um erro 403/429 mantém o último catálogo conhecido. Não compartilhe tokens em arquivos públicos ou mensagens.

Consulte `FEED-AUTOMATION-SETUP.md` para configurar os secrets do provedor autorizado.


## Automações

Consulte [AUTOMATIONS.md](AUTOMATIONS.md) para ver o que cada workflow faz e abrir sua página no GitHub Actions.
