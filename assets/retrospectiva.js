"use strict";
// O ano de cada gabinete (retrospectiva.html): os números de um deputado num ano, um quadro para cada um. Lê os mesmos
// arquivos do perfil (dados/deputados.json, dados/resumo.json e dados/dep/<id>.json); o endereço guarda a escolha
// (#d=<id>&a=<ano>), para o link levar ao mesmo retrato. O app.js chama Retro.iniciar(); as contas ficam em
// Retro.calcular, sem tela, para os testes.
const Retro = (() => {
  const MESES_NOME = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro",
    "outubro", "novembro", "dezembro"];
  const semAcento = s => (s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const somar = (lista, idx) => idx.reduce((s, i) => s + (lista[i] || 0), 0);

  // linha de dep.d: [mês, data, tipo, fornecedor, número, valor, documento, tipo do link, ano do link?, devolução?, glosa?]
  function linkDaNota(id, meses, r) {
    const ano = r[8] || Math.floor(meses[r[0]] / 100);
    if (r[7] === 0) return `https://www.camara.leg.br/cota-parlamentar/documentos/publ/${id}/${ano}/${r[6]}.pdf`;
    if (r[7] === 1) return `https://www.camara.leg.br/cota-parlamentar/nota-fiscal-eletronica?ideDocumentoFiscal=${r[6]}`;
    return null;
  }

  function calcular(dep, deputados, resumo, id, ano) {
    const meses = resumo.meses;
    const idx = meses.map((m, i) => Math.floor(m / 100) === ano ? i : -1).filter(i => i >= 0);
    const eu = deputados.find(d => d.id === id);
    if (!eu || !idx.length) return null;
    const total = somar(eu.m, idx);
    const idxAntes = meses.map((m, i) => Math.floor(m / 100) === ano - 1 ? i : -1).filter(i => i >= 0);
    const anterior = idxAntes.length ? somar(eu.m, idxAntes) : null;
    // a bancada do estado no ano: só quem teve reembolso nele
    const bancada = deputados.filter(d => d.uf === eu.uf).map(d => ({ id: d.id, v: somar(d.m, idx) })).filter(d => d.v > 0)
      .sort((a, b) => b.v - a.v || a.id - b.id);
    const posicao = bancada.findIndex(d => d.id === id) + 1;
    const media = bancada.length ? bancada.reduce((s, d) => s + d.v, 0) / bancada.length : 0;
    // o ano ainda aberto: os últimos meses publicados recebem notas por até 90 dias
    const ultimo = idx[idx.length - 1];
    const parcial = ultimo === meses.length - 1 && (meses[ultimo] % 100 !== 12 || resumo.parciais > 0);
    const noAno = new Set(idx);
    const linhas = dep.d.filter(r => noAno.has(r[0]));
    const notas = linhas.filter(r => !r[9]);
    const porTipo = new Map(), porForn = new Map();
    for (const r of notas) {
      if (resumo.cores && resumo.cores[r[2]] === -1) continue;  // ajuste ou devolução: fora das contas por tipo
      porTipo.set(r[2], (porTipo.get(r[2]) || 0) + r[5]);
      if (semAcento(resumo.categorias[r[2]]).startsWith("passag")) continue;  // companhias aéreas ficam fora, como no perfil
      const f = porForn.get(r[3]) || { v: 0, n: 0 };
      f.v += r[5]; f.n += 1;
      porForn.set(r[3], f);
    }
    const tipo = [...porTipo].sort((a, b) => b[1] - a[1])[0];
    const forn = [...porForn].sort((a, b) => b[1].v - a[1].v)[0];
    const somaTipos = [...porTipo.values()].reduce((s, v) => s + v, 0);
    const mesMaior = idx.reduce((m, i) => (eu.m[i] || 0) > (eu.m[m] || 0) ? i : m, idx[0]);
    const nota = notas.reduce((m, r) => !m || r[5] > m[5] ? r : m, null);
    return {
      id, ano, nome: eu.n, partido: eu.p, uf: eu.uf, total, anterior, parcial,
      ate: MESES_NOME[meses[ultimo] % 100 - 1], desde: MESES_NOME[meses[idx[0]] % 100 - 1],
      posicao, bancada: bancada.length, media, notas: notas.length,
      tipo: tipo && tipo[1] > 0 ? { nome: resumo.categorias[tipo[0]], v: tipo[1], fatia: somaTipos > 0 ? tipo[1] / somaTipos : 0 } : null,
      fornecedor: forn && forn[1].v > 0 ? { nome: dep.f[forn[0]] ? dep.f[forn[0]][0] : "", v: forn[1].v, n: forn[1].n } : null,
      mes: total > 0 ? { nome: MESES_NOME[meses[mesMaior] % 100 - 1], v: eu.m[mesMaior] || 0,
        limite: resumo.limites && resumo.limites[eu.uf] ? resumo.limites[eu.uf][mesMaior] : null } : null,
      nota: nota && nota[5] > 0 ? { v: nota[5], data: nota[1], tipo: resumo.categorias[nota[2]],
        fornecedor: dep.f[nota[3]] ? dep.f[nota[3]][0] : "", url: linkDaNota(id, meses, nota) } : null,
    };
  }

  // o que vai no cartão de imagem do ano
  function cartaoDoAno(r, base) {
    const linhas = [];
    if (r.posicao) linhas.push(`${r.posicao}º maior valor entre os ${r.bancada} deputados de ${r.uf} no ano`);
    if (r.tipo) linhas.push(`Maior gasto: ${r.tipo.nome.toLowerCase()} (${Math.round(r.tipo.fatia * 100)}% do ano)`);
    if (r.mes) linhas.push(`Mês mais caro: ${r.mes.nome}`);
    return { nome: r.nome, sub: `${r.partido} · ${NOMES_UF[r.uf] || r.uf}`, rotulo: `Cota parlamentar em ${r.ano}`, valor: brl(r.total),
      legenda: r.parcial ? `reembolsados em ${r.ano}, com notas até ${r.ate}` : `reembolsados em ${r.ano}`,
      linhas, url: `${base}retrospectiva.html#d=${r.id}&a=${r.ano}`, arquivo: `cota-${r.id}-${r.ano}` };
  }

  function quadro(rotulo, destaque, texto, classe = "") {
    return `<section class="retro-quadro ${classe}"><p class="retro-rotulo">${rotulo}</p>
      <p class="retro-destaque">${destaque}</p><p class="retro-texto">${texto}</p></section>`;
  }

  function desenhar(alvo, r, anos, base) {
    const perfil = `deputado/${r.id}.html`;
    const abas = anos.map(a => `<a href="#d=${r.id}&a=${a}"${a === r.ano ? ' aria-current="true"' : ""}>${a}</a>`).join("");
    const cabeca = `<header class="retro-cabeca"><p class="retro-rotulo">O ano do gabinete</p>
      <h2>${esc(r.nome)}</h2><p class="identidade">${esc(r.partido)} · ${esc(NOMES_UF[r.uf] || r.uf)}</p>
      <nav class="retro-anos" aria-label="Ano">${abas}</nav></header>`;
    if (!(r.total > 0)) {
      alvo.innerHTML = `${cabeca}<p class="aviso">Este gabinete não teve reembolsos da cota em ${r.ano}. Escolha outro ano ou veja o
        <a href="${perfil}">perfil completo</a>.</p>`;
      return;
    }
    const periodo = r.parcial ? `em ${r.ano}, com notas até ${r.ate}` : r.desde !== "janeiro" ? `de ${r.desde} a dezembro de ${r.ano}` : `em ${r.ano}`;
    let comparacao = r.desde !== "janeiro" && r.anterior === null ? "Os dados do site começam em fevereiro de 2023, com a legislatura." : "";
    if (r.anterior > 0 && !r.parcial) {
      const dif = r.total / r.anterior - 1;
      comparacao = Math.abs(dif) < 0.01 ? `Praticamente o mesmo valor de ${r.ano - 1} (${brl(r.anterior)}).`
        : `${pct(Math.abs(dif))} ${dif > 0 ? "a mais" : "a menos"} que em ${r.ano - 1} (${brl(r.anterior)}).`;
    } else if (r.anterior > 0) comparacao = `Em ${r.ano - 1}, o ano inteiro somou ${brl(r.anterior)}.`;
    const quadros = [quadro(`Recebeu da cota ${periodo}`, `<span class="retro-numero">${brl(r.total)}</span>`,
      `Em ${r.notas.toLocaleString("pt-BR")} despesas declaradas. ${comparacao}`, "retro-verde")];
    if (r.posicao) quadros.push(quadro(`Na bancada ${r.uf === "DF" ? "do" : "de"} ${esc(NOMES_UF[r.uf] || r.uf)}`,
      `<span class="retro-numero grande">${r.posicao}º</span>`,
      `maior valor entre os ${r.bancada} deputados do estado com reembolso no ano. A média deles foi ${brl(r.media)}.`));
    if (r.tipo) quadros.push(quadro("Em que gastou mais", `<span class="retro-nome">${esc(r.tipo.nome)}</span>`,
      `${brl(r.tipo.v)}, ${pct(r.tipo.fatia)} do que o gabinete recebeu no ano.`));
    if (r.fornecedor) quadros.push(quadro("Quem mais recebeu", `<span class="retro-nome">${esc(r.fornecedor.nome)}</span>`,
      `${brl(r.fornecedor.v)} em ${r.fornecedor.n.toLocaleString("pt-BR")} ${r.fornecedor.n === 1 ? "nota" : "notas"}, sem contar as passagens aéreas.`));
    if (r.mes) quadros.push(quadro("O mês mais caro", `<span class="retro-nome">${r.mes.nome}</span>`,
      `${brl(r.mes.v)} reembolsados${r.mes.limite ? `. O limite mensal do estado era ${brl(r.mes.limite)}; o saldo não usado se acumula dentro do ano` : ""}.`));
    if (r.nota) quadros.push(quadro("A maior nota", `<span class="retro-numero menor">${brl2(r.nota.v)}</span>`,
      `${esc(r.nota.fornecedor)}${r.nota.data ? `, em ${esc(r.nota.data)}` : ""}. ${esc(r.nota.tipo || "")}.`
      + (r.nota.url ? ` <a href="${esc(r.nota.url)}" target="_blank" rel="noopener">Ver a nota<span class="vh"> (abre o site da Câmara)</span></a>` : "")));
    const texto = `O ano de ${r.nome} (${r.partido}/${r.uf}) na cota parlamentar: ${brl(r.total)} ${periodo}, no De Olho na Cota.`;
    alvo.innerHTML = `${cabeca}${quadros.join("")}
      <section class="retro-fecho">
        <p class="acoes-citar"><button type="button" class="botao" id="retro-cartao" hidden>Cartão para compartilhar</button>
          <button type="button" class="botao secundario" data-compartilhar="${esc(texto)}" data-url="${esc(`${base}retrospectiva.html#d=${r.id}&a=${r.ano}`)}" data-rotulo="Compartilhar o link">Compartilhar o link</button>
          <a class="botao secundario" href="${perfil}">Ver o perfil completo</a></p>
        <p class="nota-tabela">${r.parcial ? `Os ${resumoParciais} últimos meses ainda recebem notas: os gabinetes têm até 90 dias para apresentá-las, e os números de ${r.ano} vão mudar. ` : ""}Os números descrevem o gasto declarado à Câmara. Sozinhos, não dizem se um gasto foi regular.</p>
      </section>`;
    Cartao.ligar($("#retro-cartao", alvo), () => cartaoDoAno(r, base));
  }
  let resumoParciais = 3;

  async function iniciar() {
    const alvo = $("#retro");
    const [deputados, resumo] = await Promise.all([json("dados/deputados.json"), json("dados/resumo.json")]);
    resumoParciais = resumo.parciais || 0;
    const anos = [...new Set(resumo.meses.map(m => Math.floor(m / 100)))];
    const base = ($('link[rel="canonical"]') || { href: location.href }).href.replace(/retrospectiva\.html.*$/, "");
    const busca = $("#retro-busca"), lista = $("#retro-sugestoes");
    const indice = deputados.map(d => ({ d, b: normalizar(`${d.n} ${d.b || ""}`) }));
    let sugestoes = [], ativa = -1, pedido = 0;
    $("#retro-resumo").textContent = `${deputados.length.toLocaleString("pt-BR")} deputados. Digite pelo menos três letras do nome.`;

    function fechar() { lista.hidden = true; busca.setAttribute("aria-expanded", "false"); busca.removeAttribute("aria-activedescendant"); ativa = -1; }
    function mostrar() {
      const q = normalizar(busca.value.trim());
      sugestoes = q.length < 3 ? [] : indice.filter(x => x.b.includes(q)).slice(0, 8).map(x => x.d);
      lista.innerHTML = sugestoes.map((d, i) => `<li role="option" id="retro-op-${i}" data-id="${d.id}" aria-selected="${i === ativa}">
        <span><b>${esc(d.n)}</b><small>${esc(d.p)} · ${esc(d.uf)}</small></span></li>`).join("");
      lista.hidden = !sugestoes.length;
      busca.setAttribute("aria-expanded", String(!lista.hidden));
    }
    const escolher = d => { fechar(); busca.value = ""; location.hash = `d=${d.id}&a=${anoPadrao()}`; };
    // o ano que abre: o último ano fechado, se houver; em dezembro o ano corrente já está quase inteiro
    function anoPadrao() {
      const ultimo = resumo.meses[resumo.meses.length - 1];
      const corrente = Math.floor(ultimo / 100);
      return ultimo % 100 >= 10 || anos.length === 1 ? corrente : corrente - 1;
    }
    busca.addEventListener("input", () => { ativa = -1; mostrar(); });
    busca.addEventListener("keydown", ev => {
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        if (!sugestoes.length) return;
        ev.preventDefault();
        ativa = (ativa + (ev.key === "ArrowDown" ? 1 : -1) + sugestoes.length) % sugestoes.length;
        mostrar(); busca.setAttribute("aria-activedescendant", `retro-op-${ativa}`);
      } else if (ev.key === "Enter") { ev.preventDefault(); const s = sugestoes[Math.max(ativa, 0)]; if (s) escolher(s); }
      else if (ev.key === "Escape") fechar();
    });
    lista.addEventListener("click", ev => { const li = ev.target.closest("[data-id]"); if (li) escolher(deputados.find(d => d.id === +li.dataset.id)); });
    document.addEventListener("click", ev => { if (!ev.target.closest(".busca-comparar")) fechar(); });

    async function abrir() {
      const h = new URLSearchParams(location.hash.slice(1));
      const id = +h.get("d"), eu = deputados.find(d => d.id === id);
      if (!eu) { alvo.hidden = true; return; }
      const ano = anos.includes(+h.get("a")) ? +h.get("a") : anoPadrao();
      const meu = ++pedido;
      alvo.hidden = false;
      alvo.innerHTML = `<p class="resumo">Carregando as despesas de ${esc(eu.n)}…</p>`;
      try {
        const dep = await json(`dados/dep/${id}.json`);
        if (meu !== pedido) return;
        desenhar(alvo, calcular(dep, deputados, resumo, id, ano), anos, base);
        document.title = `O ano de ${eu.n} (${eu.p}/${eu.uf}) em ${ano} · De Olho na Cota`;
        $("#retro-resumo").textContent = `Mostrando ${eu.n}, ${ano}. Para trocar, digite outro nome.`;
      } catch (erro) {
        console.error(erro);
        alvo.innerHTML = `<p class="aviso">Não foi possível abrir as despesas agora. Elas também estão no <a href="deputado/${id}.html">perfil do deputado</a>.</p>`;
      }
    }
    addEventListener("hashchange", () => { abrir().then(() => alvo.scrollIntoView({ behavior: SEM_MOVIMENTO ? "auto" : "smooth", block: "start" })); });
    abrir();
  }

  return { iniciar, calcular, cartaoDoAno, linkDaNota };
})();
if (typeof module !== "undefined") module.exports = Retro;
