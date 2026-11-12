"use strict";
// O cartão de imagem de um gabinete (perfil e retrospectiva): um PNG de 1080 × 1350 desenhado no próprio aparelho, com
// as letras do site, para mandar por WhatsApp ou rede social. Não leva a foto do deputado: a imagem vem do site da
// Câmara, e o navegador não deixa exportar um desenho que usa imagem de outro endereço.
// Os dados chegam prontos: { nome, sub, rotulo?, valor, legenda, linhas: [até 3 frases], url, arquivo }.
const Cartao = (() => {
  const W = 1080, H = 1350, M = 84;
  const COR = { fundo: "#0b3b2d", tinta: "#f2f4ef", tinta2: "#c9dacf", latao: "#b8975a", linha: "#2b5a4b" };
  const DISPLAY = `"Big Shoulders Display", "Arial Narrow", sans-serif`;
  const LEITURA = `"Source Serif 4", Georgia, serif`;
  const TEXTO = `"Source Sans 3", system-ui, sans-serif`;

  // quebra o texto em linhas que cabem em `largura`, com a fonte já posta no contexto
  function quebrar(ctx, texto, largura) {
    const linhas = [];
    let atual = "";
    for (const palavra of String(texto).split(/\s+/)) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (atual && ctx.measureText(tentativa).width > largura) { linhas.push(atual); atual = palavra; }
      else atual = tentativa;
    }
    if (atual) linhas.push(atual);
    return linhas;
  }
  // o maior corpo, entre `max` e `min`, em que o texto cabe em `largura` com até `maxLinhas` linhas
  function ajustar(ctx, texto, fonte, largura, max, min, maxLinhas = 1) {
    for (let px = max; px >= min; px -= 2) {
      ctx.font = fonte(px);
      const linhas = quebrar(ctx, texto, largura);
      if (linhas.length <= maxLinhas && linhas.every(l => ctx.measureText(l).width <= largura)) return { px, linhas };
    }
    ctx.font = fonte(min);
    return { px: min, linhas: quebrar(ctx, texto, largura).slice(0, maxLinhas) };
  }

  function desenhar(d) {
    const tela = Object.assign(document.createElement("canvas"), { width: W, height: H });
    const ctx = tela.getContext("2d");
    const L = W - 2 * M;
    ctx.fillStyle = COR.fundo;
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "alphabetic";

    // a marca e o fio de latão
    ctx.fillStyle = COR.tinta;
    ctx.font = `600 44px ${LEITURA}`;
    ctx.fillText("De Olho na Cota", M, 128);
    ctx.fillStyle = COR.latao;
    ctx.fillRect(M, 160, 96, 4);

    // quem
    let y = 300;
    const nome = ajustar(ctx, d.nome.toUpperCase(), px => `800 ${px}px ${DISPLAY}`, L, 118, 64, 2);
    ctx.fillStyle = COR.tinta;
    for (const linha of nome.linhas) { ctx.fillText(linha, M, y); y += nome.px * 0.96; }
    ctx.font = `400 40px ${TEXTO}`;
    ctx.fillStyle = COR.tinta2;
    y += 62 - nome.px * 0.96;  // a linha do partido fica logo abaixo do nome, qualquer que seja o corpo dele
    ctx.fillText(d.sub, M, y);

    // o número: ocupa a largura do cartão
    y += 96;
    if (d.rotulo) {
      ctx.font = `600 34px ${TEXTO}`;
      ctx.fillStyle = COR.latao;
      ctx.fillText(d.rotulo.toUpperCase(), M, y);
      y += 30;
    }
    const valor = ajustar(ctx, d.valor, px => `800 ${px}px ${DISPLAY}`, L, 230, 110);
    y += valor.px * 0.82;
    ctx.fillStyle = COR.tinta;
    ctx.fillText(valor.linhas[0], M - 4, y);
    ctx.font = `400 40px ${LEITURA}`;
    ctx.fillStyle = COR.tinta2;
    y += 82;
    for (const linha of quebrar(ctx, d.legenda, L).slice(0, 2)) { ctx.fillText(linha, M, y); y += 52; }

    // os fatos, entre fios
    y += 28;
    ctx.font = `400 38px ${TEXTO}`;
    for (const fato of (d.linhas || []).slice(0, 3)) {
      const partes = quebrar(ctx, fato, L).slice(0, 2);
      if (y + 44 + partes.length * 48 > H - 190) break;
      ctx.fillStyle = COR.linha;
      ctx.fillRect(M, y, L, 2);
      y += 62;
      ctx.fillStyle = COR.tinta;
      for (const linha of partes) { ctx.fillText(linha, M, y); y += 48; }
      y -= 10;
    }

    // o pé: de onde vem e onde conferir
    ctx.fillStyle = COR.linha;
    ctx.fillRect(M, H - 168, L, 2);
    ctx.font = `400 30px ${TEXTO}`;
    ctx.fillStyle = COR.tinta2;
    ctx.fillText("Dados públicos da Câmara dos Deputados. Cada valor leva à nota.", M, H - 112);
    ctx.fillStyle = COR.tinta;
    ctx.font = `600 30px ${TEXTO}`;
    ctx.fillText(ajustar(ctx, d.url.replace(/^https?:\/\//, ""), px => `600 ${px}px ${TEXTO}`, L, 30, 20).linhas[0], M, H - 66);
    return tela;
  }

  // espera as letras do site (sem elas o cartão sairia com a letra do aparelho) e devolve o PNG
  async function png(d) {
    if (document.fonts && document.fonts.load) {
      await Promise.all([`800 100px "Big Shoulders Display"`, `600 44px "Source Serif 4"`, `400 40px "Source Serif 4"`,
        `400 40px "Source Sans 3"`, `600 30px "Source Sans 3"`].map(f => document.fonts.load(f).catch(() => null)));
    }
    const tela = desenhar(d);
    return new Promise(resolve => tela.toBlob(resolve, "image/png"));
  }

  // manda pela folha de compartilhar do aparelho quando ela aceita arquivo; senão, baixa a imagem
  async function entregar(d) {
    const blob = await png(d);
    if (!blob) throw new Error("o navegador não gerou a imagem");
    const arquivo = new File([blob], `${d.arquivo || "cota"}.png`, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      try { await navigator.share({ files: [arquivo], text: `${d.nome}: ${d.valor} ${d.legenda}. ${d.url}` }); return "compartilhado"; }
      catch (erro) { if (erro.name === "AbortError") return "cancelado"; }
    }
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: arquivo.name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return "baixado";
  }

  // liga um botão ao cartão: `dados` é o objeto ou uma função que o devolve na hora do toque
  function ligar(botao, dados) {
    if (!botao || !document.createElement("canvas").getContext) return;
    const rotulo = botao.textContent;
    botao.hidden = false;
    botao.addEventListener("click", async () => {
      if (botao.disabled) return;
      botao.disabled = true;
      botao.textContent = "Preparando a imagem…";
      let fim = rotulo;
      try { if (await entregar(typeof dados === "function" ? dados() : dados) === "baixado") fim = "Imagem baixada"; }
      catch (erro) { console.error(erro); fim = "Não deu para gerar a imagem"; }
      botao.textContent = fim;
      botao.disabled = false;
      if (fim !== rotulo) setTimeout(() => { botao.textContent = rotulo; }, 2600);
    });
  }

  return { desenhar, png, entregar, ligar, quebrar };
})();
if (typeof module !== "undefined") module.exports = Cartao;
