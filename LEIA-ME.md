# workspace

Site pessoal do Paulo Asano em forma de rede 3D. Cada nó é um arquivo de texto (markdown). Os links entre arquivos viram os fios da rede.

## Ver no seu computador

- Mais simples: abra `dist/index.html` com duplo clique. Funciona sem servidor.
- Depois de editar textos, rode `node build.js` na pasta para atualizar o `dist/`.
- Para editar vendo o resultado ao vivo: `node build.js --serve` e abra http://localhost:4321. O site se refaz sozinho a cada arquivo salvo.
- Precisa só do Node.js 18 ou mais novo (nodejs.org). Não há nada para instalar além disso.

## Como as pastas estão organizadas

- `content/` é onde mora todo o conteúdo. Você só mexe aqui no dia a dia.
- `content/media/` guarda imagens, vídeos e PDFs.
- `content/_templates/` tem modelos para copiar. Pastas e arquivos que começam com `_` não vão para o site.
- `site/` é o visual (HTML, CSS, JavaScript). Só mexe se quiser mudar o design.
- `build.js` lê o `content/` e gera o site pronto em `dist/`.
- `dist/` é o site final. É essa pasta que vai para a internet. Nunca edite à mão, ela é recriada a cada build.

## Como criar um nó novo

1. Copie um arquivo de `content/_templates/` para qualquer subpasta de `content/`.
2. Renomeie com um nome curto, minúsculo e com hífens. Ex: `campanha-x-2025.md`. Esse nome vira o endereço do nó (`seusite.com/#/campanha-x-2025`).
3. Preencha o cabeçalho e escreva o texto.
4. Conecte com outros nós escrevendo o nome do arquivo entre colchetes duplos: `[[konkre]]`. Para mostrar outro texto no link: `[[konkre|a Konkrë]]`.
5. Salve e rode `node build.js` (ou deixe o `--serve` rodando).

Um link basta para criar o fio nos dois sentidos. Se `campanha-x` linka `direcao-criativa`, os dois aparecem conectados um no outro.

## O cabeçalho de cada arquivo

```
---
titulo: Nome que aparece no site
tipo: projeto
resumo: Uma frase que aparece no topo do painel e na lista.
data: 2025
tags: [marca, campanha]
capa: foto-principal.jpg
status: placeholder
---
```

- `titulo`: obrigatório na prática. Sem ele, o site usa o nome do arquivo.
- `tipo`: categoria do nó. Hoje existem `hub`, `area`, `work`, `venture`, `life`, `path`. A cor da esfera vem da área à qual o nó está ligado.
- `resumo`, `data`, `tags`, `capa`: opcionais.
- `status: placeholder`: mostra o selo "Conteúdo provisório". Apague a linha quando o texto for definitivo.
- `publicar: false`: esconde o nó do site sem apagar o arquivo.
- `conecta: [nome-a, nome-b]`: cria fios sem precisar citar no texto.
- `apelidos: [Konkrë, Konkre]`: outros nomes que também resolvem o link.
- `ordem: 1`: ordem na lista (menor aparece primeiro).

## Imagens e vídeos

- Coloque o arquivo em `content/media/`.
- No texto: `![[foto.jpg]]` (jeito Obsidian) ou `![descrição](media/foto.jpg)`.
- Vídeos do YouTube ou Vimeo: cole o código de incorporação (`<iframe ...>`) direto no texto.
- Prefira imagens em JPG ou WebP com até 2000 px de largura para o site continuar leve.

## Editar com o Obsidian (recomendado, opcional)

A pasta `content/` já é compatível com o Obsidian. Abra o Obsidian, escolha "Open folder as vault" e selecione `content/`. Você escreve com o mesmo `[[link]]`, vê a mesma rede no Graph View do próprio Obsidian e o site reflete tudo no próximo build. Nenhum plugin é necessário.

## Anos de carreira

Escreva `{{years}}` no texto. O site calcula sozinho a partir de janeiro de 1999.

## Configuração (site/config.js)

- `siteName`: nome do site (hoje "workspace"). Troque aqui e muda em todo lugar.
- `gate`: trava de entrada (nome + LinkedIn). `false` desliga.
- `tracking`: registro de cadastros e visitas numa planilha Google. Desligado. Para ligar, colar a URL do Apps Script e revisar o aviso de privacidade (LGPD).

## Publicação

O site está no GitHub (siuji/workspace) e é publicado sozinho a cada alteração enviada para a branch main.

## Publicar na internet (histórico)

Recomendação: GitHub Pages ou Cloudflare Pages. Os dois são gratuitos para este uso e servem só arquivos estáticos, então não há lock-in. Se um dia quiser trocar, basta subir a pasta `dist/` em outro lugar.

Caminho sugerido, GitHub Pages:

1. Criar uma conta gratuita no GitHub e um repositório (ex: `workspace`).
2. Subir esta pasta inteira para o repositório.
3. No repositório: Settings > Pages > Source: GitHub Actions.
4. O arquivo `.github/workflows/deploy.yml` já está pronto: a cada alteração enviada, o GitHub roda o build e publica.
5. Para domínio próprio (ex: pauloasano.com), configurar em Settings > Pages > Custom domain.

Alternativa sem GitHub: Netlify Drop ou Cloudflare Pages aceitam arrastar a pasta `dist/` pelo navegador.

Nada disso foi feito ainda. Nenhuma conta criada, nada publicado.

## O que está no site

- Rede 3D que gira sozinha até a primeira interação. Arrastar gira, rolar aproxima, clicar abre o painel.
- Painel com texto, imagens, tags e lista de conexões clicáveis.
- Cada nó tem link próprio para compartilhar (`#/nome-do-arquivo`).
- Busca por título e texto.
- Filtro por tipo na legenda.
- Botão "Lista" com todos os nós em grade, mais prático no celular e para quem quer ler direto.
- Versão em texto para buscadores e navegadores sem JavaScript.
- Funciona no celular (painel vira gaveta inferior).

## Tecnologia

- HTML, CSS e JavaScript puros, sem framework.
- Grafo: biblioteca `3d-force-graph` (MIT), incluída em `site/vendor/`. Não depende de CDN.
- Markdown: biblioteca `marked` (MIT), incluída em `tools/`, usada só no build.
