# Atualização automática do feed autorizado

## Secrets do GitHub

No repositório, abra **Settings → Secrets and variables → Actions → New repository secret** e crie:

- `OFFICIAL_FEED_URL`: URL RSS/API oficial autorizada pelo provedor.
- `OFFICIAL_FEED_TOKEN`: token oficial, se o provedor exigir. Pode ficar vazio apenas se o endpoint for público.
- `OFFICIAL_FEED_ALLOWED_HOSTS`: hosts autorizados separados por vírgula, por exemplo `www.pornhub.com,pornhub.com`.
- `OFFICIAL_EMBED_TEMPLATE`: use somente se o feed não enviar o embed, por exemplo `https://www.pornhub.com/embed/{id}`.
- `OFFICIAL_FEED_MIN_DURATION_SECONDS`: opcional; padrão de 60 segundos. O workflow permite configurar 60, 300 ou 900 segundos na execução manual.

O workflow não usa cookies roubados, não imita navegador e não segue redirecionamentos para hosts desconhecidos. Se a fonte continuar respondendo `403`, o snapshot anterior permanece intacto.

## Cloudflare Pages

Conecte o projeto Pages ao repositório GitHub e selecione a branch `main` em **Settings → Builds & deployments**. Cada commit feito pelo workflow poderá então disparar um novo deploy.

## Execução

O workflow roda a cada seis horas e aceita vídeos oficiais com duração mínima padrão de 60 segundos. Na execução manual, escolha 60, 300 ou 900 segundos em **Actions → Update authorized video feed → Run workflow**. Registros sem duração confiável continuam sendo rejeitados.

O site lê `public/data/videos.json` server-side. O arquivo `data/videos.json` fica como fonte versionada no repositório e ambos são atualizados atomicamente.
