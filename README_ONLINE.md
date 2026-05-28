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

## Backend recomendado com Google Sheets

1. Crie uma planilha no Google Sheets.
2. Abra `Extensões > Apps Script`.
3. Apague o conteúdo padrão.
4. Cole o conteúdo do arquivo `google-apps-script-backend.js`.
5. Clique em `Implantar > Nova implantação`.
6. Tipo: `App da Web`.
7. Executar como: `Eu`.
8. Quem pode acessar: `Qualquer pessoa`.
9. Copie a URL gerada.
10. Cole essa URL no `config.js` em `API_URL`.

Depois disso, todas as ordens passam a ser salvas na planilha e aparecem para todos os aparelhos.

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
