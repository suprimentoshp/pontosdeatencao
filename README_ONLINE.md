# Publicação online

Este app pode rodar como app Node/Express no Render, com histórico compartilhado entre todos os equipamentos.

## Render com histórico compartilhado

1. Envie este projeto para o GitHub.
2. No Render, crie um `New Web Service`.
3. Conecte o repositório.
4. Use:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Configure um Persistent Disk:
   - Mount Path: `/opt/render/project/src/data`
   - Tamanho: `1 GB`
6. Publique o serviço.

O app ficará disponível em uma URL parecida com:

```text
https://pontosdeatencao.onrender.com
```

Todos devem acessar por essa URL online. Assim as ordens ficam salvas em:

```text
data/ordens.json
```

Se o Persistent Disk não estiver configurado, o Render pode apagar o histórico quando reiniciar o serviço.

## API usada pelo app

O navegador carrega o histórico em:

```text
GET /api/app-data
```

E salva o histórico completo em:

```text
PUT /api/app-data
```

Formato:

```json
{ "orders": [] }
```

## GitHub Pages

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
