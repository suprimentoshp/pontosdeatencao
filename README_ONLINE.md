# Publicação online

Este app está pronto para publicar como site estático, por exemplo no GitHub Pages.

## GitHub Pages

1. Crie um repositório no GitHub.
2. Envie todos os arquivos desta pasta para o repositório.
3. No GitHub, abra `Settings > Pages`.
4. Em `Build and deployment`, escolha `GitHub Actions`.
5. Faça push na branch `main`.
6. O workflow `.github/workflows/pages.yml` publica o app automaticamente.

## Dados entre vários equipamentos

Sem backend, cada aparelho salva apenas no próprio navegador. Para todos os celulares/computadores verem as mesmas ordens, configure um endpoint em `config.js`.

O endpoint deve aceitar `POST` com JSON:

```json
{ "action": "list" }
{ "action": "create", "order": {} }
{ "action": "update", "id": "abc", "changes": {} }
{ "action": "delete", "id": "abc" }
```

Resposta esperada para `list`:

```json
{ "orders": [] }
```

Depois de criar seu backend, edite:

```js
window.APP_CONFIG = {
  API_URL: "https://seu-endpoint.com",
  API_TOKEN: ""
};
```

## Celular

O layout está responsivo e inclui `manifest.json` e `service-worker.js`, permitindo uso como PWA quando publicado por HTTPS.
