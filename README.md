# Posterfeito — pôster grande, impressora comum

Aplicação web para transformar uma **imagem ou página de PDF** em um pôster dividido em folhas A4, A3 ou Carta. O aplicativo é **gratuito**, não exige cadastro, não tem anúncios e **processa os arquivos localmente no navegador**. Projeto pronto para hospedar no **Vercel** pelo **GitHub**.

A interface é inspirada na clareza visual do Notion e em utilitários de impressão: fundo claro, controles objetivos e destaque para o resultado final. Não copia marca, logotipo ou código de outros serviços.

## Funcionalidades já implementadas

- Envio por clique ou arrastar e soltar: JPG, JPEG, PNG, WEBP, GIF, BMP e PDF (até 80 MB).
- Em arquivos PDF com várias páginas, seleção da página de origem. A página é rasterizada localmente antes da edição.
- Sugestões automáticas de divisão conforme proporção da imagem.
- Grade manual de 1 a 8 colunas por 1 a 8 linhas (até 64 folhas).
- Papel A4, A3 e Carta; retrato e paisagem; margem de segurança de 5 a 25 mm.
- Sobreposição nas emendas de 0 a 15 mm.
- Ajustes de zoom, posição horizontal/vertical, rotação, espelhamento, brilho, contraste e escala de cinza.
- Enquadramento **mostrar inteira** (sem cortes) ou **preencher** (podendo cortar bordas).
- Efeito opcional de **pontos artísticos**, no estilo de pôsteres Rasterbator.
- Prévia da arte, grade com identificação das folhas e modo ampliado.
- Estimativa de resolução (DPI) da imagem de origem no pôster.
- Exportação local em PDF de 150, 200 ou 300 DPI; cada folha ocupa uma página do PDF.
- Marcas de corte opcionais; identificação opcional de cada folha (A1, B1…).
- **Página final de instruções opcional**: mapa com miniatura da arte e a grade, sequência de montagem, impressão em 100% e tamanho final. Desativando o guia, o PDF contém **apenas as folhas do pôster**.
- Download automático e opção de baixar novamente.
- Responsivo para desktop e celular; indicadores de erro, progresso e cancelamento da geração.

## Requisitos

- Node.js 22 ou mais recente recomendado (mínimo 20.19).
- npm.
- Navegador moderno com suporte a Canvas e Web Workers.

## Rodando no computador

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal (normalmente http://localhost:5173).

Para verificar a compilação de produção:

```bash
npm run build
npm run preview
```

O site compilado fica em `dist/`.

## Publicar pelo GitHub e Vercel

1. Descompacte esta pasta.
2. No GitHub, crie um repositório **novo** (por exemplo, `posterfeito`).
3. Envie **os arquivos dentro da pasta** para a raiz do repositório. Não envie `node_modules` nem `dist`. Você pode usar **Add file > Upload files** ou os comandos Git abaixo.
4. Na Vercel, escolha **Add New > Project > Import Git Repository** e conecte o seu repositório GitHub.
5. Confira **Framework Preset = Vite**, **Build Command = `npm run build`**, **Output Directory = `dist`**. Para este site, **não precisa configurar variáveis de ambiente**.
6. Clique em **Deploy**. A Vercel fornece uma URL para o aplicativo.
7. Cada atualização enviada à branch de produção do GitHub cria um novo deploy.

Exemplo com terminal (substitua a URL pelo repositório que você criou):

```bash
git init
git add .
git commit -m "Criar Posterfeito"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/posterfeito.git
git push -u origin main
```

> Importante: Não suba o `.zip` como um único arquivo para dentro do repositório. O GitHub precisa conter `package.json`, `index.html`, `src/` e outros arquivos na raiz.

## Como funciona a montagem

Em um pôster **2 colunas × 2 linhas**, a ordem de impressão/montagem é:

```text
 A1 | B1
----+----
 A2 | B2
```

Em A4 retrato com margem de **10 mm** e **sem sobreposição**, a área impressa de cada folha é `190 × 277 mm`; o pôster final tem **380 × 554 mm**, ou **38,0 × 55,4 cm**. Esse é o mesmo tamanho do exemplo anexado pelo usuário.

Quando há sobreposição, os últimos milímetros da arte são repetidos na folha vizinha. A dimensão final diminui pelo total de milímetros sobrepostos entre folhas. O usuário pode recortar as bordas brancas e sobrepor as partes impressas para facilitar a montagem.

## Impressão correta

1. Selecione tamanho de papel e orientação iguais aos usados no aplicativo.
2. Na janela de impressão, use **100% / Tamanho real** (nunca **Ajustar à página**).
3. Selecione **uma página por folha**, sem impressão N-up.
4. Faça um teste antes de imprimir tudo. Confira as margens suportadas pela sua impressora.
5. Recorte as margens brancas e use as marcas/identificações para montar o pôster.

## Sobre privacidade e limitações

- **Não há backend nem upload para servidor.** O arquivo é carregado e convertido na memória do navegador; o PDF final é salvo pelo próprio navegador.
- Bibliotecas de terceiros (`pdfjs-dist` e `pdf-lib`) são instaladas pelo npm e servidas como parte do site compilado. O navegador pode baixar recursos de fonte do Google para a interface; se houver falha na rede, fontes do sistema são usadas. As imagens do usuário não são enviadas ao Google.
- A importação de PDF usa `pdfjs-dist`: páginas com senha, documentos corrompidos ou PDFs extremamente grandes podem falhar. Cada vez uma única página de origem é tratada como arte; não é feita conversão em lote de todas as páginas de entrada.
- A página PDF de origem é **rasterizada** para edição (limite de 3600 px no lado maior); não preserva as curvas vetoriais da origem.
- DPI no resumo refere-se à **imagem de entrada** após o escalonamento. O DPI de exportação ajusta a resolução do PDF, mas não cria detalhes que não existem na imagem original.
- Em dispositivos com pouca memória, reduzir a quantidade de folhas e usar 150/200 DPI ajuda. Impressoras domésticas normalmente não imprimem até a borda; respeite as margens.
- Não há mecanismo de salvar projetos, remover fundos por IA, contas, pagamentos ou processamento em lote. Esses recursos podem ser adicionados em fases futuras.

## Organização do código

```text
src/
  App.tsx                Interface e gerenciamento de estado
  styles.css             Visual e responsividade
  lib/config.ts          Unidades, modelos e cálculos de tamanho
  lib/imports.ts         Importação de imagem e PDF
  lib/renderer.ts        Desenho, efeitos e PDF de saída
```

## Licença

Este projeto inicial é entregue para você adaptar e hospedar. Os termos de uso das bibliotecas externas permanecem os de seus respectivos projetos.
