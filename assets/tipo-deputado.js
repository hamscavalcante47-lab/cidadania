"use strict";
// Um tipo de gasto de um deputado (gasto-deputado.html#d=<id>&t=<tipo>&a=<ano>) ou de um senador
// (gasto-senador.html#s=<código>&t=<tipo>&a=<ano>, com dados/senadores.json, dados/sen/<código>.json e
// dados/senado-tipos.json, que traz os nomes dos tipos em `s`): todas as notas do gabinete naquele
// tipo, com o gasto e a quantidade de notas mês a mês, a maior nota de cada mês, os fornecedores e a posição do gabinete
// entre os deputados que gastaram com o tipo. Lê os arquivos do perfil (dados/deputados.json, dados/resumo.json e
// dados/dep/<id>.json) e o do tipo no ranking (dados/tipos/<índice>.json); não há arquivo próprio por deputado e tipo.
// `t` é o nome do tipo na página Gastos (resumo.slugs), o mesmo dos links do perfil. O app.js chama TipoDep.iniciar();
// as contas ficam em TipoDep.calcular, sem tela, para os testes.
const TipoDep = (() => {
  const somar = (lista, idx) => idx.reduce((s, i) => s + (lista[i] || 0), 0);

  // linha de dep.d: [mês, data, tipo, fornecedor, número, valor, documento, tipo do link, ano do link?, devolução?, glosa?]
  function linkDaNota(id, meses, r) {
    const ano = r[8] || Math.floor(meses[r[0]] / 100);
    if (r[7] === 0) return `https://www.camara.leg.br/cota-parlamentar/documentos/publ/${id}/${ano}/${r[6]}.pdf`;
    if (r[7] === 1) return `https://www.camara.leg.br/cota-parlamentar/nota-fiscal-eletronica?ideDocumentoFiscal=${r[6]}`;
    return null;
  }

  // os meses do período: o mandato inteiro (ano nulo) ou um ano
  const mesesDo = (meses, ano) => meses.map((m, i) => !ano || Math.floor(m / 100) === ano ? i : -1).filter(i => i >= 0);

  // `serieTodos`: dados/tipos/<t>.json ({id: [valor em cada mês]}), para a posição entre os deputados; pode faltar
  function calcular(dep, resumo, id, t, ano = null, serieTodos = null) {
    const meses = resumo.meses;
    const idx = mesesDo(meses, ano);
    if (!idx.length) return null;
    const noPeriodo = new Set(idx);
    const doTipo = dep.d.filter(r => r[2] === t && noPeriodo.has(r[0]));
    // a linha de devolução (valor zero e o devolvido em r[9]) não é nota: entra só na conta do devolvido
    const notas = doTipo.filter(r => !r[9]);
    const devolvido = doTipo.reduce((s, r) => s + (r[9] || 0), 0);
    const total = doTipo.reduce((s, r) => s + r[5], 0);
    // o gabinete inteiro no período, sem os ajustes (cor -1, como a complementação do auxílio-moradia)
    const totalGabinete = dep.d.filter(r => noPeriodo.has(r[0]) && (resumo.cores?.[r[2]] ?? 0) >= 0)
      .reduce((s, r) => s + r[5], 0);
    const pos = new Map(idx.map((i, k) => [i, k]));
    const valores = idx.map(() => 0), quantidade = idx.map(() => 0), maiores = idx.map(() => null);
    for (const r of doTipo) {
      const k = pos.get(r[0]);
      valores[k] += r[5];
      if (r[9]) continue;
      quantidade[k] += 1;
      if (!maiores[k] || r[5] > maiores[k][5]) maiores[k] = r;
    }
    const porForn = new Map();
    for (const r of notas) {
      const f = porForn.get(r[3]) || { f: r[3], v: 0, n: 0 };
      f.v += r[5]; f.n += 1;
      porForn.set(r[3], f);
    }
    const fornecedores = [...porForn.values()].sort((a, b) => b.v - a.v || a.f - b.f);
    const positivas = notas.filter(r => r[5] > 0);
    const valoresPos = positivas.map(r => r[5]).sort((a, b) => a - b);
    const mediana = valoresPos.length ? (valoresPos.length % 2 ? valoresPos[(valoresPos.length - 1) / 2]
      : (valoresPos[valoresPos.length / 2 - 1] + valoresPos[valoresPos.length / 2]) / 2) : 0;
    // as maiores notas: o documento desempata (a mesma base dá sempre a mesma lista)
    const maioresNotas = [...positivas].sort((a, b) => b[5] - a[5] || (a[6] || 0) - (b[6] || 0)).slice(0, 10);
    const kMaior = valores.reduce((m, v, k) => v > valores[m] ? k : m, 0);
    // a posição entre os deputados que tiveram reembolso no tipo no período
    let ranking = null;
    if (serieTodos) {
      const somas = Object.entries(serieTodos).map(([pid, s]) => ({ id: +pid, v: somar(s, idx) })).filter(x => x.v > 0)
        .sort((a, b) => b.v - a.v || a.id - b.id);
      const vs = somas.map(x => x.v).sort((a, b) => a - b);
      const meio = vs.length ? (vs.length % 2 ? vs[(vs.length - 1) / 2] : (vs[vs.length / 2 - 1] + vs[vs.length / 2]) / 2) : 0;
      const p = somas.findIndex(x => x.id === id) + 1;
      ranking = { posicao: p || null, deputados: somas.length, mediana: meio };
    }
    const ultimo = idx[idx.length - 1];
    return {
      id, t, ano, meses: idx.map(i => meses[i]), indices: idx, valores, quantidade, maiores,
      total, devolvido, totalGabinete, fatia: totalGabinete > 0 ? total / totalGabinete : 0,
      notas: notas.length, positivas: positivas.length, media: positivas.length ? positivas.reduce((s, r) => s + r[5], 0) / positivas.length : 0,
      mediana, maiorNota: maioresNotas[0] || null, maioresNotas, fornecedores,
      mesesComGasto: valores.filter(v => v > 0).length,
      mesMaior: total > 0 ? { mes: meses[idx[kMaior]], v: valores[kMaior] } : null,
      // os últimos meses publicados ainda recebem notas (até 90 dias)
      parciais: ultimo === meses.length - 1 ? Math.min(resumo.parciais || 0, idx.length) : 0,
      linhas: doTipo, ranking,
    };
  }

  // colunas, uma por mês: a quantidade de notas (a contagem não cabe numa linha contínua, que sugere valores entre os meses)
  function graficoColunas(el, meses, valores, { rotulo = "notas", aoClicar = null, parciais = 0 } = {}) {
    lembrar(el, () => graficoColunas(el, meses, valores, { rotulo, aoClicar, parciais }));
    const L = largura(el), H = 200, m = { e: 40, d: 12, t: 18, b: 26 };
    const max = Math.max(1, ...valores);
    const passo = max <= 5 ? 1 : max <= 10 ? 2 : Math.ceil(max / 4 / 5) * 5;
    const topo = Math.ceil(max / passo) * passo;
    const n = valores.length, larguraMes = (L - m.e - m.d) / n, coluna = Math.max(2, larguraMes * 0.72);
    const x = i => m.e + i * larguraMes + (larguraMes - coluna) / 2;
    const y = v => H - m.b - v / topo * (H - m.t - m.b);
    const marcas = Array.from({ length: topo / passo + 1 }, (_, k) => k * passo);
    const grade = marcas.map(v => `<line class="grade" x1="${m.e}" x2="${L - m.d}" y1="${y(v)}" y2="${y(v)}"/>
      <text class="eixo" x="${m.e - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join("");
    const anos = meses.map((a, i) => [a, i]).filter(([a], i) => a % 100 === 1 || i === 0).map(([a, i]) =>
      `<text class="eixo" x="${m.e + i * larguraMes + 2}" y="${H - 8}">${Math.floor(a / 100)}</text>`).join("");
    const iParcial = n - parciais;
    const colunas = valores.map((v, i) => `<rect class="barra-g${i >= iParcial ? " parcial-col" : ""}" data-i="${i}" x="${x(i).toFixed(1)}"
      y="${y(v).toFixed(1)}" width="${coluna.toFixed(1)}" height="${Math.max(0, y(0) - y(v)).toFixed(1)}" rx="2"><title>${nomeMesLongo(meses[i])}: ${v} ${v === 1 ? rotulo.replace(/s$/, "") : rotulo}</title></rect>`).join("");
    const iMax = valores.indexOf(max);
    el.innerHTML = `<svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Quantidade de ${rotulo} por mês; o mês com mais foi ${nomeMesLongo(meses[iMax])}, com ${max}">
      ${grade}${anos}${colunas}</svg>`;
    if (aoClicar) el.onclick = e => { const r = e.target.closest("[data-i]"); if (r) aoClicar(+r.dataset.i); };
  }

  function desenhar(alvo, c, ctx) {
    const { eu, resumo, dep, nomeTipo, slug, tiposDoGabinete, anos, temPagina, casa } = ctx;
    const meses = resumo.meses, f = i => dep.f[i] || ["", ""];
    // a nota de hotel lançada como refeição, confirmada na revisão (dep.ho: as linhas dela em dep.d)
    const hotel = new Set((dep.ho || []).map(i => dep.d[i]));
    const endereco = (tipo, ano) => `#${casa.chave}=${eu.id}&t=${tipo}${ano ? `&a=${ano}` : ""}`;
    const abasTipo = tiposDoGabinete.map(x => `<a href="${endereco(x.slug, c.ano)}"${x.t === c.t ? ' aria-current="true"' : ""}>${esc(x.nome)}</a>`).join("");
    const abasAno = [null, ...anos].map(a => `<a href="${endereco(slug, a)}"${a === c.ano ? ' aria-current="true"' : ""}>${a || "Todo o mandato"}</a>`).join("");
    const periodo = c.ano ? `em ${c.ano}` : "desde fevereiro de 2023";
    const cabeca = `<header class="secao gd-cabeca">
      <nav class="abas" aria-label="Tipo de gasto do gabinete">${abasTipo}</nav>
      <nav class="abas gd-anos" aria-label="Período">${abasAno}</nav></header>`;
    if (!c.linhas.length) {
      alvo.innerHTML = `${cabeca}<p class="aviso secao">${esc(eu.n)} não teve despesas com ${esc(nomeTipo.toLowerCase())} ${periodo}.
        Escolha outro período ou outro tipo de gasto.</p>`;
      return;
    }
    const r = c.ranking;
    const comparacao = r && r.posicao ? `<span class="comparacao${c.total > r.mediana ? " acima" : ""}">${r.posicao}º entre ${r.deputados.toLocaleString("pt-BR")} ${casa.varios}</span>` : "";
    const fatos = `<div class="cartao fatos"><dl>
      <div><dt>Reembolsado ${periodo}</dt><dd class="num">${brl(c.total)}</dd>${comparacao}</div>
      <div><dt>Notas</dt><dd class="num">${c.notas.toLocaleString("pt-BR")}</dd><span class="comparacao">em ${c.mesesComGasto} ${c.mesesComGasto === 1 ? "mês" : "meses"}</span></div>
      <div><dt>Valor médio por nota</dt><dd class="num">${brl2(c.media)}</dd><span class="comparacao">mediana ${brl2(c.mediana)}</span></div>
      <div><dt>Do total do gabinete</dt><dd class="num">${pct(c.fatia)}</dd><span class="comparacao">${c.fornecedores.length} ${c.fornecedores.length === 1 ? "fornecedor" : "fornecedores"}</span></div>
    </dl></div>`;
    const frase = [`${esc(eu.n)} recebeu <b>${brl2(c.total)}</b> da cota com ${esc(nomeTipo.toLowerCase())} ${periodo}, em ${c.notas.toLocaleString("pt-BR")} ${c.notas === 1 ? "nota" : "notas"}`];
    if (c.mesMaior) frase.push(`O mês com mais gasto foi ${nomeMesLongo(c.mesMaior.mes)} (${brl2(c.mesMaior.v)})`);
    if (c.maiorNota) frase.push(`A maior nota foi de ${brl2(c.maiorNota[5])}, de ${esc(f(c.maiorNota[3])[0])}, em ${esc(c.maiorNota[1] || nomeMes(meses[c.maiorNota[0]]))}${hotel.has(c.maiorNota) ? " (a nota é de uma diária de hotel, não de refeição)" : ""}`);
    if (r && r.posicao) frase.push(`Entre os ${r.deputados.toLocaleString("pt-BR")} ${casa.varios} que tiveram reembolso neste tipo ${periodo}, é o ${r.posicao}º maior valor; ${casa.doMeio} da lista recebeu ${brl(r.mediana)}`);
    if (c.devolvido > 0) frase.push(`O gabinete devolveu ${brl2(c.devolvido)} ${casa.aCasa} neste tipo`);
    const linkNota = x => casa.link(x);
    const verNota = x => { const u = linkNota(x); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener">ver ${casa.documento}<span class="vh"> (abre o site ${casa.daCasa})</span></a>` : casa.semLink(x); };
    const valorNota = x => (x[9] ? `<span class="cat">devolução de</span> ${brl2(x[9])}` : brl2(x[5]) + (x[10] ? glosaHTML(...x[10]) : ""))
      + (hotel.has(x) ? `<span class="glosa">nota de hotel: diária, não refeição</span>` : "");
    const fornecedor = i => { const [nome, doc] = f(i); return `${esc(nome)}<br><span class="mono cat">${esc(doc)}</span>`; };
    // mês a mês: só os meses com despesa, do mais recente para o mais antigo
    const linhasMes = c.indices.map((_, k) => k).filter(k => c.quantidade[k] || c.valores[k]).reverse().map(k => {
      const mx = c.maiores[k];
      return `<tr><td data-v="${c.meses[k]}"><button type="button" class="gd-mes" data-mes="${c.meses[k]}">${nomeMesLongo(c.meses[k])}</button></td>
        <td class="n">${c.quantidade[k]}</td><td class="n" data-v="${c.valores[k].toFixed(2)}">${brl2(c.valores[k])}</td>
        <td data-v="${mx ? mx[5] : 0}">${mx ? `<b>${brl2(mx[5])}</b>${hotel.has(mx) ? " (nota de hotel)" : ""} · ${esc(f(mx[3])[0])}<br><span class="cat">${esc(mx[1] || "")}</span> ${verNota(mx)}` : "—"}</td></tr>`;
    }).join("");
    const linhasForn = c.fornecedores.slice(0, 15).map(x => `<tr><td>${fornecedor(x.f)}</td><td class="n">${x.n}</td>
      <td class="n" data-v="${x.v.toFixed(2)}">${brl2(x.v)}</td><td class="n">${c.total > 0 ? pct(x.v / c.total) : "—"}</td></tr>`).join("");
    const linhasMaiores = c.maioresNotas.map(x => `<tr><td class="mono">${esc(x[1] || nomeMes(meses[x[0]]))}</td><td>${fornecedor(x[3])}</td>
      <td class="n" data-v="${x[5].toFixed(2)}">${valorNota(x)}</td><td>${verNota(x)}</td></tr>`).join("");
    const opcoesMes = [...new Set(c.linhas.map(x => meses[x[0]]))].sort((a, b) => b - a)
      .map(mm => `<option value="${mm}">${nomeMesLongo(mm)}</option>`).join("");
    const textoCompartilhar = `${nomeTipo} de ${eu.n} (${eu.p}/${eu.uf}) na cota parlamentar: ${brl(c.total)} ${periodo}, no De Olho na Cota.`;
    alvo.innerHTML = `${cabeca}
      <p class="em-resumo">${frase.join(". ")}.</p>
      ${fatos}
      <section class="secao cartao"><h3>Quanto foi gasto mês a mês</h3>
        <p class="sub">O valor reembolsado em cada mês, pelo mês da despesa ${casa.naCasa}. Clique num mês para ver as notas dele.</p>
        <div class="grafico" id="gd-valores"></div></section>
      <section class="secao cartao"><h3>Quantas notas por mês</h3>
        <p class="sub">Cada coluna é um mês; a altura é o número de notas do tipo.${c.parciais ? " Os últimos meses ainda recebem notas." : ""}</p>
        <div class="grafico" id="gd-quantidade"></div></section>
      <section class="secao cartao"><h3>Mês a mês: notas, total e a maior nota</h3>
        <p class="sub">Só os meses com despesa neste tipo, do mais recente para o mais antigo.</p>
        <div class="rolagem tabela-alta"><table id="gd-meses"><tr><th>Mês</th><th class="n">Notas</th><th class="n">Total</th><th>Maior nota do mês</th></tr>${linhasMes}</table></div></section>
      <div class="duas secao">
        <section class="cartao"><h3>Maiores notas</h3><p class="sub">As ${c.maioresNotas.length} notas de maior valor ${periodo}.</p>
          <div class="rolagem tabela-alta"><table id="gd-maiores"><tr><th>Data</th><th>Fornecedor</th><th class="n">Valor</th><th class="sem-ordem">Nota</th></tr>${linhasMaiores}</table></div></section>
        <section class="cartao"><h3>Fornecedores</h3><p class="sub">Quem recebeu neste tipo ${periodo}${c.fornecedores.length > 15 ? " (os 15 maiores)" : ""}.</p>
          <div class="rolagem tabela-alta"><table id="gd-forn"><tr><th>Fornecedor</th><th class="n">Notas</th><th class="n">Total</th><th class="n">Parte</th></tr>${linhasForn}</table></div></section>
      </div>
      <section class="secao" id="gd-notas">
        <header><div><h2>Todas as notas deste tipo</h2><p>Cada reembolso com o link da nota. Filtre por mês ou fornecedor.</p></div>
          <button type="button" class="botao secundario" id="gd-csv">Baixar planilha (CSV)</button></header>
        <div class="cartao">
          <div class="lista-topo"><div class="filtros sem-margem">
            <label class="vh" for="gd-mes">Mês</label><select id="gd-mes"><option value="">Todos os meses</option>${opcoesMes}</select>
            <label class="vh" for="gd-busca">Fornecedor</label><input id="gd-busca" type="search" placeholder="Fornecedor ou CNPJ"></div>
            <p class="resumo" id="gd-resumo" aria-live="polite"></p></div>
          <div class="rolagem tabela-alta"><table id="gd-tabela"></table></div>
          <div id="gd-glosa" hidden>${$("#gd-aviso-glosa")?.innerHTML || ""}</div>
          <button type="button" class="mais" id="gd-mais" hidden>Mostrar mais</button>
        </div>
      </section>
      <section class="secao retro-fecho">
        <p class="acoes-citar"><a class="botao" href="${casa.perfil}">${casa.verPerfil}</a>
          ${temPagina ? `<a class="botao secundario" href="gastos/${slug}.html">${esc(nomeTipo)} em todos os gabinetes</a>` : ""}
          <button type="button" class="botao secundario" data-compartilhar="${esc(textoCompartilhar)}" data-url="${esc(location.href)}" data-rotulo="Compartilhar o link">Compartilhar o link</button></p>
        <p class="nota-tabela">O tipo de gasto é o que o gabinete declarou ${casa.aCasa}, e o mês é o da despesa ${casa.naCasa} (a nota pode ser de alguns dias antes). Os números
          descrevem o gasto declarado; sozinhos, não dizem se um gasto foi regular.</p>
      </section>`;

    // as notas: filtro por mês e fornecedor, ordenáveis, cem por vez
    const estado = { mes: "", busca: "", limite: 100, ordem: ["data", "descending"] };
    function filtrar() {
      const q = normalizar(estado.busca), qd = estado.busca.replace(/\D/g, "");
      const lista = c.linhas.filter(x => (!estado.mes || meses[x[0]] === +estado.mes) &&
        (!q || normalizar(f(x[3])[0]).includes(q) || (qd.length >= 3 && f(x[3])[1].replace(/\D/g, "").includes(qd))));
      const chave = { data: x => x[1] ? +`${x[1].slice(6)}${x[1].slice(3, 5)}${x[1].slice(0, 2)}` : meses[x[0]] * 100,
        fornecedor: x => normalizar(f(x[3])[0]), numero: x => /^\d+$/.test(x[4]) ? +x[4] : x[4] ? normalizar(x[4]) : null,
        valor: x => x[5] }[estado.ordem[0]];
      return lista.map(x => [chave(x), x]).sort((a, b) => comparar(a[0], b[0], estado.ordem[1])).map(x => x[1]);
    }
    function desenharNotas() {
      const lista = filtrar(), soma = lista.reduce((s, x) => s + x[5], 0);
      $("#gd-resumo").textContent = `${lista.length.toLocaleString("pt-BR")} ${lista.length === 1 ? "nota" : "notas"} · ${brl2(soma)}`
        + (estado.mes ? ` em ${nomeMesLongo(+estado.mes)}` : "");
      $("#gd-tabela").innerHTML = `<tr><th data-chave="data">Data</th><th data-chave="fornecedor">Fornecedor</th><th data-chave="numero">Nº</th>
        <th class="n" data-chave="valor">Valor</th><th class="sem-ordem">Nota</th></tr>` + lista.slice(0, estado.limite).map(x =>
        `<tr><td class="mono">${esc(x[1] || nomeMes(meses[x[0]]))}</td><td>${fornecedor(x[3])}</td><td class="mono">${esc(x[4])}</td>
          <td class="n">${valorNota(x)}</td><td>${verNota(x)}</td></tr>`).join("")
        + (lista.length ? "" : `<tr><td colspan="5" class="vazio">Nenhuma nota com esses filtros.</td></tr>`);
      $("#gd-tabela").dataset.ordem = estado.ordem.join(":");
      tabelaOrdenavel($("#gd-tabela"), (coluna, direcao) => { estado.ordem = [coluna, direcao]; estado.limite = 100; desenharNotas(); });
      $("#gd-mais").hidden = lista.length <= estado.limite;
      $("#gd-glosa").hidden = !lista.slice(0, estado.limite).some(x => x[10]);
    }
    const verMes = mm => {
      estado.mes = String(mm); estado.limite = 100; $("#gd-mes").value = estado.mes; desenharNotas();
      $("#gd-notas").scrollIntoView({ behavior: SEM_MOVIMENTO ? "auto" : "smooth", block: "start" });
    };
    $("#gd-mes").addEventListener("change", e => { estado.mes = e.target.value; estado.limite = 100; desenharNotas(); });
    $("#gd-busca").addEventListener("input", e => { estado.busca = e.target.value; estado.limite = 100; desenharNotas(); });
    $("#gd-mais").addEventListener("click", () => { estado.limite += 100; desenharNotas(); });
    $("#gd-meses").addEventListener("click", e => { const b = e.target.closest(".gd-mes"); if (b) verMes(+b.dataset.mes); });
    $("#gd-csv").addEventListener("click", () => baixarCSV(`${arquivo(nomeTipo)}-${arquivo(eu.n)}${c.ano ? "-" + c.ano : ""}.csv`,
      ["Data", "Mês", "Fornecedor", "CNPJ/CPF", "Número da nota", "Valor reembolsado (R$)", "Devolvido (R$)", "Valor da nota (R$)", "Glosa (R$)", "Link da nota"],
      filtrar().map(x => [x[1], nomeMes(meses[x[0]]), ...f(x[3]), x[4], x[5], x[9] || "", x[10] ? x[10][0] : "", x[10] ? x[10][1] : "", linkNota(x) || ""])));
    desenharNotas();
    for (const id of ["#gd-meses", "#gd-maiores", "#gd-forn"]) tabelaOrdenavel($(id));
    graficoLinha($("#gd-valores"), c.meses, c.valores.map(v => Math.round(v)), { altura: 230, parciais: c.parciais, aoClicar: k => verMes(c.meses[k]) });
    graficoColunas($("#gd-quantidade"), c.meses, c.quantidade, { parciais: c.parciais, aoClicar: k => verMes(c.meses[k]) });
  }

  // as notas de um senador (dados/sen/<código>.json: [ano, data, tipo, fornecedor, número, valor, número do PDF, mês])
  // no formato das linhas do deputado, com o índice do mês em `meses` (resumo.meses_senado). O arquivo antigo, sem o
  // mês, usa o da data do documento. A linha fora da janela fica de fora
  function doSenado(dados, meses) {
    const pos = new Map(meses.map((m, i) => [m, i]));
    const d = [];
    for (const n of dados.d) {
      const mes = n[7] || +String(n[1]).slice(3, 5);
      const i = pos.get(n[0] * 100 + mes);
      if (i === undefined) continue;
      d.push([i, n[1], n[2], n[3], n[4], n[5], n[6]]);
    }
    return { f: dados.f, d, u: dados.u };
  }

  // o que muda entre as casas: os arquivos, as palavras e o link do documento
  const CASAS = {
    d: { chave: "d", varios: "deputados", doMeio: "o deputado do meio", aCasa: "à Câmara", daCasa: "da Câmara",
      naCasa: "na Câmara", documento: "nota", verPerfil: "Ver o perfil completo" },
    s: { chave: "s", varios: "senadores", doMeio: "o senador do meio", aCasa: "ao Senado", daCasa: "do Senado",
      naCasa: "no Senado", documento: "documento", verPerfil: "Ver a página do senador" },
  };

  // `chave`: "d" (gasto-deputado.html, #d=<id>) ou "s" (gasto-senador.html, #s=<código>)
  async function iniciar(chave = "d") {
    const sen = chave === "s", casa = { ...CASAS[chave] };
    const alvo = $("#gd"), vazio = $("#gd-vazio");
    const [lista, resumo, tiposSen] = await Promise.all([json(sen ? "dados/senadores.json" : "dados/deputados.json"),
      json("dados/resumo.json"), sen ? json("dados/senado-tipos.json") : null]);
    const gabinetes = sen ? lista.map(s => ({ id: s.c, n: s.n, p: s.p, uf: s.uf })) : lista;
    const meses = sen ? (resumo.meses_senado || resumo.meses) : resumo.meses;
    // as contas leem `meses` e `categorias` daqui: no Senado, os meses e os 7 tipos dele
    const base = sen ? { meses, parciais: resumo.parciais, categorias: tiposSen.t } : resumo;
    const anos = [...new Set(meses.map(m => Math.floor(m / 100)))];
    const slugs = (sen ? tiposSen.s : resumo.slugs) || [];
    let pedido = 0;
    async function abrir() {
      const h = new URLSearchParams(location.hash.slice(1));
      const id = +h.get(chave), eu = gabinetes.find(d => d.id === id);
      const t = slugs.indexOf(h.get("t"));
      if (!eu || t < 0) { alvo.hidden = true; vazio.hidden = false; return; }
      const ano = anos.includes(+h.get("a")) ? +h.get("a") : null;
      const meu = ++pedido;
      vazio.hidden = true; alvo.hidden = false;
      const nomeTipo = base.categorias[t];
      const pagina = sen ? `senador/${id}.html` : `deputado/${id}.html`;
      $("#gd-titulo").textContent = nomeTipo;
      $("#gd-trilha").textContent = nomeTipo;
      const perfil = $("#gd-perfil");
      perfil.textContent = eu.n; perfil.href = pagina;
      $("#gd-lead").innerHTML = `${esc(eu.n)} · ${esc(eu.p)} · ${esc(NOMES_UF[eu.uf] || eu.uf)}. Todas as notas do gabinete neste tipo de gasto, mês a mês.`;
      alvo.innerHTML = `<p class="resumo">Carregando as despesas de ${esc(eu.n)}…</p>`;
      try {
        let dep, serie;
        if (sen) {
          dep = doSenado(await json(`dados/sen/${id}.json`), meses);
          // a série do tipo de cada senador, para a posição entre eles
          serie = Object.fromEntries(Object.entries(tiposSen.v).map(([c, tipos]) => [c, tipos[t] || []]));
          casa.link = x => x[6] ? dep.u + x[6] : null;
          casa.semLink = x => x[6] === 0 ? `<span class="cat" title="O link existe, mas o Senado responde vazio">arquivo não publicado</span>` : "—";
          casa.perfil = `${pagina}#notas`;
        } else {
          [dep, serie] = await Promise.all([json(`dados/dep/${id}.json`), json(`dados/tipos/${t}.json`).catch(() => null)]);
          casa.link = x => linkDaNota(id, meses, x);
          casa.semLink = () => "—";
          casa.perfil = `${pagina}#despesas`;
        }
        if (meu !== pedido) return;
        // os tipos em que o gabinete teve reembolso, do maior para o menor, para trocar de tipo sem voltar à página dele
        const somaTipo = new Map();
        dep.d.forEach(r => somaTipo.set(r[2], (somaTipo.get(r[2]) || 0) + r[5]));
        const tiposDoGabinete = [...somaTipo].filter(([i, v]) => v > 0 && slugs[i]).sort((a, b) => b[1] - a[1])
          .map(([i]) => ({ t: i, slug: slugs[i], nome: base.categorias[i] }));
        desenhar(alvo, calcular(dep, base, id, t, ano, serie),
          { eu, resumo: base, dep, nomeTipo, slug: slugs[t], tiposDoGabinete, anos, temPagina: !sen && !!slugs[t], casa });
        document.title = `${nomeTipo}: ${eu.n} (${eu.p}/${eu.uf})${ano ? ` em ${ano}` : ""} · De Olho na Cota`;
      } catch (erro) {
        console.error(erro);
        alvo.innerHTML = `<p class="aviso">Não foi possível abrir as despesas agora. Elas também estão na <a href="${pagina}">página do gabinete</a>.</p>`;
      }
    }
    addEventListener("hashchange", () => { abrir().then(() => scrollTo({ top: 0, behavior: SEM_MOVIMENTO ? "auto" : "smooth" })); });
    abrir();
  }

  return { iniciar, calcular, linkDaNota, doSenado };
})();
if (typeof module !== "undefined") module.exports = TipoDep;
