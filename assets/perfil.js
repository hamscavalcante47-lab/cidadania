"use strict";
// Linha do tempo do perfil do deputado: gráfico mês a mês com o trilho das notas com indício próprio, recorte por
// ano, mês escolhido (controle deslizante), cartão do mês e os fornecedores com indício; e o painel (E4) com o motivo
// e o histórico de cada nota, alerta, fornecedor ou mês. Carregado só nas páginas de deputado (antes do app.js, que
// chama LinhaDoTempo.iniciar); usa os utilitários do app.js (esc, brl, nomeMes...).
// Os dados vêm de dados/dep/<id>.json: 'a' (um item por alerta, na ordem dos <article> da página: chave, escopo e
// linhas de 'd'), 'h' (o histórico de cada alerta, na mesma ordem) e 'd' (as despesas). Gravidade, título, motivo,
// revisão e link de cada alerta vêm do próprio <article>, que já passou pelos filtros do gerador.
(function (exportar) {

const ESCOPO_NOTA = 0, ESCOPO_DIA = 1, ESCOPO_SEM_NOTA = 3;
const POR_MES = 4;  // pontos empilhados por mês no trilho; o quarto vira "+" quando há mais

// ------------------------------------------------------------------ lógica (sem página: testada no Node)

// o mês (índice) em que cai a maior parte das linhas; no empate, o mais antigo
function mesDaMaioria(linhas, d) {
  const conta = new Map();
  linhas.forEach(i => conta.set(d[i][0], (conta.get(d[i][0]) || 0) + 1));
  let melhor = null;
  for (const [m, n] of conta) if (melhor === null || n > conta.get(melhor) || (n === conta.get(melhor) && m < melhor)) melhor = m;
  return melhor;
}

// o fornecedor (índice em 'f') com mais linhas; no empate, o de maior valor e depois o de menor índice
function fornecedorDaMaioria(linhas, d) {
  const conta = new Map();
  linhas.forEach(i => {
    const c = conta.get(d[i][3]) || [0, 0];
    conta.set(d[i][3], [c[0] + 1, c[1] + d[i][5]]);
  });
  return [...conta].sort((x, y) => y[1][0] - x[1][0] || y[1][1] - x[1][1] || x[0] - y[0])[0][0];
}

// junta cada item de 'a' ao <article> da mesma posição, conferindo a chave; se não casar (página em cache com dados
// novos), procura a chave entre os que sobraram. Devolve, por posição, o dado do <article> ou null
function resolver(a, info) {
  const usados = new Set(), porChave = new Map();
  info.forEach((x, k) => { if (!porChave.has(x.chave)) porChave.set(x.chave, []); porChave.get(x.chave).push(k); });
  const pos = a.map(([chave], k) => {
    if (info[k] && info[k].chave === chave) { usados.add(k); return k; }
    return null;
  });
  return a.map(([chave], k) => {
    if (pos[k] !== null) return info[pos[k]];
    const livre = (porChave.get(chave) || []).find(j => !usados.has(j) && !pos.includes(j));
    if (livre === undefined) return null;
    usados.add(livre);
    return info[livre];
  });
}

// pontos[mês]: notas com indício próprio (escopo nota; uma por linha, com todos os alertas dela) e padrões de um dia
// (escopo dia; um losango por alerta, no mês da maioria das notas). grupos: os demais alertas juntos pelo fornecedor
// da maioria das notas, com as notas distintas, os meses e o total. comIndicio: os meses com ponto ou nota de grupo.
// Mês que a página não tem (HTML em cache, arquivo de dados mais novo) fica fora do desenho e é contado em foraDosMeses
function montar(a, d, info, nMeses) {
  const dados = resolver(a, info);
  const pontos = Array.from({ length: nMeses }, () => []);
  const notas = new Map(), grupos = new Map();
  let ignorados = 0, foraDosMeses = 0;
  const noDesenho = m => (m >= 0 && m < nMeses) || (foraDosMeses++, false);
  a.forEach(([chave, escopo, linhas], k) => {
    const x = dados[k];
    if (!x) { ignorados++; return; }
    if (escopo === ESCOPO_NOTA) {
      linhas.forEach(i => {
        if (!notas.has(i) && !noDesenho(d[i][0])) return;
        if (!notas.has(i)) notas.set(i, { tipo: "nota", linha: i, mes: d[i][0], valor: d[i][5], g: 0, alertas: [] });
        const n = notas.get(i);
        n.alertas.push(k);
        n.g = Math.max(n.g, x.g);
      });
    } else if (escopo === ESCOPO_DIA) {
      const mes = linhas.length ? mesDaMaioria(linhas, d) : -1;
      if (!linhas.length || !noDesenho(mes)) return;
      pontos[mes].push({ tipo: "dia", k, mes, g: x.g, n: linhas.length, valor: linhas.reduce((s, i) => s + d[i][5], 0),
        linha: linhas[0] });
    } else {
      const forn = linhas.length ? fornecedorDaMaioria(linhas, d) : -1;
      if (!grupos.has(forn)) grupos.set(forn, { forn, alertas: [], g: 0, linhas: new Set() });
      const gr = grupos.get(forn);
      gr.alertas.push(k);
      gr.g = Math.max(gr.g, x.g);
      linhas.forEach(i => gr.linhas.add(i));
    }
  });
  notas.forEach(n => pontos[n.mes].push(n));
  pontos.forEach(l => l.sort((p, q) => q.g - p.g || q.valor - p.valor || p.linha - q.linha));
  const lista = [...grupos.values()].map(gr => {
    const linhas = [...gr.linhas].sort((p, q) => p - q), meses = new Map();
    linhas.forEach(i => { if (noDesenho(d[i][0])) meses.set(d[i][0], (meses.get(d[i][0]) || 0) + 1); });
    const ms = [...meses.keys()];
    return { forn: gr.forn, alertas: gr.alertas, g: gr.g, linhas, meses,
      total: Math.round(linhas.reduce((s, i) => s + d[i][5], 0) * 100) / 100,
      varias: new Set(linhas.map(i => d[i][3])).size > 1,
      m0: ms.length ? Math.min(...ms) : null, m1: ms.length ? Math.max(...ms) : null,
      confirmados: gr.alertas.filter(k => dados[k].veredito === "confirmado").length };
  }).sort((p, q) => q.g - p.g || q.total - p.total || p.forn - q.forn);
  const comIndicio = new Set();
  pontos.forEach((l, m) => { if (l.length) comIndicio.add(m); });
  lista.forEach(gr => gr.meses.forEach((_, m) => comIndicio.add(m)));
  return { pontos, grupos: lista, comIndicio: [...comIndicio].sort((p, q) => p - q), dados, ignorados, foraDosMeses };
}

// ------------------------------------------------------------------ E8: pacote CSV e gráfico para matéria (Node)

const ESCOPO_ROTULO = ["indício numa nota", "padrão de um dia", "padrão do conjunto de notas", "sem nota ligada"];
const CABECALHO_PACOTE = ["Gravidade", "Alerta", "Tipo de indício", "O que foi encontrado", "Revisão", "Data da nota",
  "Competência", "Fornecedor", "CNPJ/CPF", "Tipo de despesa", "Nº do documento", "Valor da nota (R$)", "Nota na Câmara",
  "Página permanente do alerta", "Ficha no perfil"];
// o pacote CSV do deputado: uma linha por nota citada em cada alerta (o alerta sem nota ligada, ou com as notas fora
// dos meses do perfil, numa linha só), na ordem dos alertas da página. dados: o resolver de montar (null = alerta que a
// página não tem, fora). o: meses, categorias, linkNota, nomeMes, base (o endereço do perfil, sem #) e, por alerta,
// revisao (texto) e pagina (endereço completo da página permanente)
function linhasDoPacote(a, d, f, dados, o) {
  const linhas = [];
  a.forEach(([chave, escopo, idx], k) => {
    const x = dados[k];
    if (!x) return;
    const comum = [GRAV[x.g] || "", x.titulo, ESCOPO_ROTULO[escopo] || "", x.desc || "", x.revisao || "pendente"];
    const fim = ficha => [x.pagina || "", `${o.base}#${ficha}`];
    // nota de mês que a página não conhece (HTML em cache, dados novos) fica de fora, como no gráfico
    const notas = idx.filter(i => d[i] && o.meses[d[i][0]] !== undefined);
    if (!notas.length) linhas.push([...comum, "", "", "", "", "", "", null, "", ...fim(`alerta=${chave}`)]);
    notas.forEach(i => {
      const r = d[i], [nome, doc] = f[r[3]] || ["", ""];
      linhas.push([...comum, r[1] || "", o.nomeMes(o.meses[r[0]]), nome, doc, (o.categorias && o.categorias[r[2]]) || "",
        r[4] || "", r[5], (o.linkNota && o.linkNota(r)) || "", ...fim(r[6] ? `nota=${r[6]}` : `alerta=${chave}`)]);
    });
  });
  return linhas;
}

// as cores do tema claro (estilo.css, :root), fixas no SVG para matéria: o arquivo sai igual com o site no escuro, e
// sem as variáveis do CSS, que fora da página não valem
const CORES_SVG = { tinta: "#101915", tinta2: "#3f4b45", tinta3: "#56635c", linha: "#dde2de", papel: "#ffffff",
  papel2: "#f0f2ef", verde: "#0b5d46", alta: "#a3271c", media: "#7a5200", baixa: "#4a5750" };
// cada classe do desenho vira atributos de apresentação (fill, stroke, fonte), e não um <style>: editores como o
// Illustrator não aplicam seletores compostos (.pt.g3) nem a forma curta de font
const FONTE_SVG = `font-family="Arial, Helvetica, sans-serif"`, MONO_SVG = `font-family="'Courier New', monospace"`;
const ATRIBUTOS_SVG = {
  "eixo": `font-size="11" ${MONO_SVG} fill="${CORES_SVG.tinta3}"`,
  "eixo forte": `font-size="11" font-weight="600" ${FONTE_SVG} fill="${CORES_SVG.tinta2}"`,
  "grade": `stroke="${CORES_SVG.linha}" stroke-width="1"`,
  "linha-g": `fill="none" stroke="${CORES_SVG.verde}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`,
  "limite-g": `fill="none" stroke="${CORES_SVG.tinta3}" stroke-width="1.5" stroke-dasharray="5 4"`,
  "hachura-traco": `stroke="${CORES_SVG.tinta3}" stroke-width="1" stroke-opacity=".35"`,
  "trilho": `fill="${CORES_SVG.papel2}" stroke="${CORES_SVG.linha}"`,
  "pt g3": `fill="${CORES_SVG.alta}"`,
  "pt g2": `fill="${CORES_SVG.media}"`,
  "pt g1": `fill="${CORES_SVG.papel}" stroke="${CORES_SVG.baixa}" stroke-width="1.6"`,
  "mais": `font-size="12" font-weight="700" ${FONTE_SVG} fill="${CORES_SVG.tinta}"`,
};
const TEXTO_SVG = {
  tit: `font-size="20" font-weight="600" font-family="Georgia, serif" fill="${CORES_SVG.tinta}"`,
  sub: `font-size="12" ${FONTE_SVG} fill="${CORES_SVG.tinta2}"`,
  fonte: `font-size="11" ${FONTE_SVG} fill="${CORES_SVG.tinta2}"`,
};
// o arquivo SVG pronto para matéria: o desenho do gráfico (corpo, sem a seleção nem o alvo do toque) com título,
// legenda em texto, fonte e data de corte; t: { titulo, periodo, edicao (dd/mm/aaaa), url, parcial, mais }
function svgParaMateria(corpo, W, H, t) {
  const topo = 96, base = 50, alto = topo + H + base, x0 = 16;
  const linhasTexto = [
    ["tit", 28, `Reembolsos da cota parlamentar: ${t.titulo}`],
    ["sub", 48, `Valor reembolsado por mês, em reais (R$), ${t.periodo}. Tracejado: limite da cota${t.parcial ? "; hachura: meses que ainda recebem notas" : ""}.`],
    ["sub", 66, "Embaixo, notas com indício próprio: cheio vermelho, gravidade alta; âmbar, média; vazado, baixa; losango, padrão de um dia."],
    ["sub", 84, t.mais ? "Até três por mês; o sinal + indica que o mês tem mais (a lista completa está no perfil)." : ""],
    ["fonte", topo + H + 22, `Fonte: Câmara dos Deputados (dados abertos), via De Olho na Cota · edição de ${t.edicao} · ${t.url}`],
    ["fonte", topo + H + 38, "Indício não é acusação: é um padrão nos dados públicos que pede explicação."],
  ].filter(l => l[2]);
  // o arquivo é XML: & < > e aspas escapados (o esc do app.js não está no Node)
  const xml = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const desenho = corpo.replace(/var\(--verde\)/g, CORES_SVG.verde)
    .replace(/class="([^"]+)"/g, (m, c) => ATRIBUTOS_SVG[c] ? `${m} ${ATRIBUTOS_SVG[c]}` : m);
  return `<?xml version="1.0" encoding="utf-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${alto}" viewBox="0 0 ${W} ${alto}">`
    + `<title>${xml(linhasTexto[0][2])}</title>`
    + `<rect width="${W}" height="${alto}" fill="${CORES_SVG.papel}"/>`
    + linhasTexto.map(([c, y, texto]) => `<text ${TEXTO_SVG[c]} x="${x0}" y="${y}">${xml(texto)}</text>`).join("")
    + `<g transform="translate(0 ${topo})">${desenho}</g></svg>\n`;
}

// recortes do gráfico: tudo e cada ano ("" e "AAAA", como o #per= da tabela de despesas)
function janelas(meses) {
  const lista = [{ id: "", rotulo: "Tudo", i0: 0, i1: meses.length - 1 }];
  meses.forEach((m, i) => {
    const ano = String(Math.floor(m / 100)), ultima = lista[lista.length - 1];
    if (ultima.id === ano) ultima.i1 = i;
    else lista.push({ id: ano, rotulo: ano, i0: i, i1: i });
  });
  return lista;
}

// mês escolhido ao abrir: o do endereço (#per=AAAAMM); num ano (#per=AAAA), a última nota com indício dele; senão, a
// última nota com indício; sem nenhuma, o último mês
function mesInicial(meses, pontos, periodo) {
  const p = String(periodo || "");
  if (p.length === 6 && meses.includes(+p)) return meses.indexOf(+p);
  const noAno = p.length === 4 ? meses.map((m, i) => Math.floor(m / 100) === +p ? i : -1).filter(i => i >= 0) : [];
  const faixa = noAno.length ? noAno : meses.map((_, i) => i);
  for (let k = faixa.length - 1; k >= 0; k--) if (pontos[faixa[k]] && pontos[faixa[k]].length) return faixa[k];
  return faixa[faixa.length - 1];
}

// ------------------------------------------------------------------ painel: endereço e histórico (testados no Node)

// as vistas do painel e a chave de cada uma no endereço (#nota=, #alerta=, #forn=, #mes=), que convivem com o #per= da
// tabela de despesas. Quando um endereço feito à mão traz mais de uma, vale a primeira desta lista
const VISTAS = ["nota", "alerta", "forn", "mes"];
// dia 0 das datas de 'h': o primeiro dia do Cidadania (BASE_HISTORICO no gerador)
const BASE_HISTORICO = "2026-10-26";
const MESES_EXTENSO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro",
  "outubro", "novembro", "dezembro"];

// um fragmento comum (#despesas, #alertas) não é lista de parâmetros
const parametros = hash => {
  const texto = String(hash || "").replace(/^#/, "");
  return new URLSearchParams(texto.includes("=") ? texto : "");
};

// o endereço com as mudanças ({chave: valor}; null tira a chave): uma vista nova tira as outras e o resto fica
function enderecoCom(hash, mudancas) {
  const p = parametros(hash);
  if (VISTAS.some(v => mudancas[v] != null)) VISTAS.forEach(v => p.delete(v));
  Object.entries(mudancas).forEach(([k, v]) => { if (v == null) p.delete(k); else p.set(k, v); });
  const texto = p.toString();
  return texto ? `#${texto}` : "";
}

function vistaDoEndereco(hash) {
  const p = parametros(hash), tipo = VISTAS.find(v => p.get(v));
  return tipo ? { tipo, valor: p.get(tipo) } : null;
}

const diaISO = n => new Date(Date.parse(`${BASE_HISTORICO}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const dataDoDia = n => n == null ? "sem data" : diaISO(n).split("-").reverse().join("/");

// as linhas de 'd' de um documento (r[6], o código da Câmara). Um documento pode ter mais de um lançamento (bilhete e
// estorno, dois tipos de gasto): as citadas em alerta vêm primeiro. Código vazio ou 0 não identifica nota
function linhasDoDocumento(d, ide, citadas = new Set()) {
  const alvo = String(ide ?? "").trim();
  if (!alvo || alvo === "0") return [];
  const todas = [];
  d.forEach((r, i) => { if (r[6] != null && String(r[6]) === alvo) todas.push(i); });
  return [...todas.filter(i => citadas.has(i)), ...todas.filter(i => !citadas.has(i))];
}

// as posições em 'a' dos alertas que citam alguma das linhas
function alertasDasLinhas(a, linhas) {
  const procuradas = new Set(linhas);
  return a.flatMap(([, , ls], k) => ls.some(i => procuradas.has(i)) ? [k] : []);
}

const VEREDITOS = ["confirmado", "inconclusivo", "descartado", "retirada"];

// um item de 'h' ([dias até a detecção, ...eventos], códigos no dicionário de dados) em eventos legíveis, por data
// (o que não tem data fica no fim); null quando o item não veio (arquivo de dados anterior à E4) ou veio mal formado
function eventosDoAlerta(item) {
  if (!Array.isArray(item) || !Number.isInteger(item[0])) return null;
  const lista = [{ tipo: "detectado", dia: item[0] }];
  item.slice(1).forEach(e => {
    if (!Array.isArray(e)) return;
    const [c, dia] = e;
    if (c === 1) lista.push({ tipo: "removido", dia });
    else if (c === 2) lista.push({ tipo: "reapareceu", dia });
    else if (c === 3) lista.push({ tipo: "gravidade", dia, de: e[2], para: e[3] });
    else if (c === 4) lista.push({ tipo: "descricao", dia, versoes: e[2] });
    else if (c === 5) lista.push({ tipo: "revisao", dia, veredito: VEREDITOS[e[2]] || "", assistida: !!e[3], herdada: !!e[4] });
    else if (c === 6) lista.push({ tipo: "pedido", dia, canal: e[2] === 1 ? "lai" : "gabinete", prazo: e[3] ?? null, id: e[4] });
    else if (c === 7) lista.push({ tipo: "resposta", dia, id: e[2] });
    else if (c === 8) lista.push({ tipo: "recurso", dia, id: e[2] });
  });
  // a resposta diz de quem veio pelo canal do pedido
  const canais = new Map(lista.filter(ev => ev.tipo === "pedido").map(ev => [ev.id, ev.canal]));
  lista.forEach(ev => { if (ev.tipo === "resposta") ev.canal = canais.get(ev.id) || "gabinete"; });
  const ordem = ev => ev.dia ?? 1e9;
  return lista.sort((x, y) => ordem(x) - ordem(y));
}

// E8: "novo desde a sua última visita" (guardado só no navegador). O retrato de um perfil é, por código de alerta,
// quantos eventos de novidade ('h': gravidade, descrição, revisão, pedido, resposta, recurso; saiu e voltou não contam)
// ele tem; a visita guardada é { e: data da edição, a: retrato, ant e antE: o retrato e a data da visita de antes }
const EVENTOS_DE_NOVIDADE = [3, 4, 5, 6, 7, 8];
function retratoDosAlertas(a, h) {
  const r = {};
  (a || []).forEach(([chave], k) => {
    const item = (h || [])[k];
    const n = Array.isArray(item) ? item.slice(1).filter(ev => Array.isArray(ev) && EVENTOS_DE_NOVIDADE.includes(ev[0])).length : 0;
    r[chave] = Math.max(r[chave] || 0, n);
  });
  return r;
}
const mesmoRetrato = (x, y) => Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => y[k] === x[k]);
// o que gravar (null: nada) e com que visita comparar (null: nada a marcar). Guardado inválido, ou de uma edição mais
// nova que a de agora (a data recuou), vale como primeira visita. Na mesma edição com o mesmo retrato (recarregou a
// página), a comparação continua a da visita de antes; com retrato diferente (dados novos no mesmo dia), é nova visita
function proximaVisita(guardado, edicao, retrato) {
  const ok = g => g && typeof g === "object" && /^\d{4}-\d\d-\d\d/.test(String(g.e || "")) && g.a && typeof g.a === "object";
  if (!ok(guardado) || guardado.e > edicao) return { gravar: { e: edicao, a: retrato }, base: null };
  if (guardado.e === edicao && mesmoRetrato(guardado.a, retrato))
    return { gravar: null, base: guardado.ant && typeof guardado.ant === "object" ? { e: guardado.antE, a: guardado.ant } : null };
  return { gravar: { e: edicao, a: retrato, ant: guardado.a, antE: guardado.e }, base: { e: guardado.e, a: guardado.a } };
}
// por posição em 'a': "novo" (código que não estava na visita de antes), "mudou" (ganhou evento de novidade) ou null
function novidadesDesde(a, retrato, base) {
  return (a || []).map(([chave]) => !base ? null : !(chave in base.a) ? "novo" : retrato[chave] > base.a[chave] ? "mudou" : null);
}

// os mesmos rótulos de rotulo_revisao, no gerador
function rotuloRevisao(ev) {
  if (ev.veredito === "retirada") return "Revisão herdada retirada: as versões anteriores deixaram de ter uma revisão comum";
  const t = ev.herdada
    ? { confirmado: ev.assistida ? "Confirmado em revisão assistida" : "Confirmado",
        inconclusivo: ev.assistida ? "Revisão assistida, sem conclusão" : "Revisado, sem conclusão",
        descartado: ev.assistida ? "Descartado em revisão assistida" : "Descartado" }
    : { confirmado: ev.assistida ? "Confirmado em revisão assistida" : "Confirmado na revisão",
        inconclusivo: ev.assistida ? "Revisão assistida, sem conclusão" : "Revisado, sem conclusão",
        descartado: ev.assistida ? "Descartado em revisão assistida" : "Descartado na revisão" };
  return (t[ev.veredito] || "Revisão registrada") + (ev.herdada ? " (na versão anterior)" : "");
}

const GRAV_NOME = { 3: "alta", 2: "média", 1: "baixa" };
const NOVA_VERIFICACAO = "Este site · numa nova verificação dos dados";

// o que aconteceu e de onde vem a data
function textoEvento(ev) {
  if (ev.tipo === "detectado") return {
    rotulo: ev.dia === 0 ? "Detectado pelo De Olho na Cota na primeira verificação do sistema" : "Detectado pelo De Olho na Cota",
    fonte: "Este site · data em que o sistema encontrou o padrão, não a data do fato" };
  if (ev.tipo === "removido") return { rotulo: "Deixou de ser apontado",
    fonte: "Os dados da Câmara ou da Receita mudaram, ou a regra foi ajustada" };
  if (ev.tipo === "reapareceu") return { rotulo: "Voltou a ser apontado", fonte: NOVA_VERIFICACAO };
  if (ev.tipo === "gravidade") return {
    rotulo: `Gravidade mudou de ${GRAV_NOME[ev.de] || "outra"} para ${GRAV_NOME[ev.para] || "outra"}`, fonte: NOVA_VERIFICACAO };
  if (ev.tipo === "descricao") return { rotulo: "A descrição foi atualizada com dados novos",
    fonte: `O alerta ganhou outro código (${ev.versoes > 1 ? `${ev.versoes} versões anteriores` : "1 versão anterior"}); o histórico continua o delas` };
  if (ev.tipo === "revisao") return { rotulo: rotuloRevisao(ev), fonte: ev.veredito === "retirada" ? "Este site"
    : ev.assistida ? "Este site · revisão feita com agentes de IA, sem confirmação de uma pessoa" : "Este site · revisão feita por uma pessoa" };
  if (ev.tipo === "pedido") return {
    rotulo: ev.canal === "lai" ? "Pedido à Câmara pela Lei de Acesso à Informação" : "E-mail ao gabinete pedindo explicação",
    fonte: ev.prazo != null ? `Prazo para a resposta: ${dataDoDia(ev.prazo)}` : "Detalhes em Pedidos de esclarecimento" };
  if (ev.tipo === "resposta") return { rotulo: ev.canal === "lai" ? "Resposta da Câmara recebida" : "Resposta do gabinete recebida",
    fonte: "Detalhes em Pedidos de esclarecimento" };
  if (ev.tipo === "recurso") return { rotulo: "Recurso apresentado", fonte: "Lei de Acesso à Informação, art. 15" };
  return { rotulo: "", fonte: "" };
}

// a linha do tempo de uma nota ou de um alerta: [{quando, rotulo, fonte, pedido, vazado}], em ordem. `nota`: {data
// (dd/mm/aaaa), mes (AAAAMM), fornecedor} ou null; `alertas`: [{titulo, h (o item de 'h'), revisado}]. Com mais de um
// alerta, o mesmo fato (a detecção num dia, o mesmo pedido) vira um item só, e os outros eventos dizem de qual alerta
// são. Sem revisão, termina em "Ainda não revisado", que é o estado normal e não indica culpa nem inocência
const DO_PEDIDO = ["pedido", "resposta", "recurso"];
function linhaDoTempo(nota, alertas) {
  const itens = [], varios = alertas.length > 1;
  const emissao = nota && nota.data ? nota.data.split("/").reverse().join("-") : "";
  if (emissao) itens.push({ ordem: emissao, quando: nota.data,
    rotulo: `Nota emitida${nota.fornecedor ? ` por ${nota.fornecedor}` : ""}`, fonte: "Câmara dos Deputados, dados abertos" });
  if (nota && nota.mes) {
    const nome = MESES_EXTENSO[nota.mes % 100 - 1];
    itens.push({ ordem: `${Math.floor(nota.mes / 100)}-${String(nota.mes % 100).padStart(2, "0")}-~`,
      quando: `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${Math.floor(nota.mes / 100)}`,
      rotulo: "Reembolso lançado nesta competência", fonte: "Câmara · a fonte não informa o dia" });
  }
  // o alerta apontado antes de a nota existir não a detectou: ela entrou nele depois
  const texto = ev => ev.tipo === "detectado" && emissao && diaISO(ev.dia) < emissao
    ? { rotulo: "Alerta apontado pela primeira vez", fonte: "Esta nota entrou nele depois, quando chegou aos dados da Câmara" }
    : textoEvento(ev);
  const eventos = alertas.map(al => eventosDoAlerta(al.h));
  const grupos = new Map();
  let unico = 0;
  const agrupar = (ev, k) => {
    const chave = !varios ? unico++ : ev.tipo === "detectado" ? `d|${ev.dia}|${texto(ev).rotulo}`
      : DO_PEDIDO.includes(ev.tipo) ? `${ev.tipo}|${ev.id}|${ev.dia}` : unico++;
    if (!grupos.has(chave)) grupos.set(chave, { ev, titulos: [] });
    grupos.get(chave).titulos.push(alertas[k].titulo);
  };
  // a detecção primeiro: no mesmo dia, ela vem antes do que aconteceu depois dela (a ordenação é estável)
  eventos.forEach((lista, k) => (lista || []).forEach(ev => { if (ev.tipo === "detectado") agrupar(ev, k); }));
  eventos.forEach((lista, k) => (lista || []).forEach(ev => { if (ev.tipo !== "detectado") agrupar(ev, k); }));
  grupos.forEach(({ ev, titulos }) => {
    const t = texto(ev);
    const de = !varios ? "" : titulos.length === 1 ? `: ${titulos[0]}` : ` (${titulos.length} alertas)`;
    itens.push({ ordem: ev.dia == null ? "9999" : diaISO(ev.dia), quando: dataDoDia(ev.dia), rotulo: t.rotulo + de,
      fonte: t.fonte, pedido: DO_PEDIDO.includes(ev.tipo) ? ev.id : null });
  });
  const semHistorico = alertas.filter((_, k) => !eventos[k]);
  if (alertas.length && semHistorico.length === alertas.length) itens.push({ ordem: "~", quando: "—", vazado: true,
    rotulo: "Histórico indisponível", fonte: semHistorico.every(al => al.h === undefined)
      ? "O arquivo de dados é de uma versão anterior do site: recarregue a página" : "O histórico deste alerta não foi registrado" });
  const semRevisao = alertas.filter(al => !al.revisado).length;
  if (semRevisao) itens.push({ ordem: "~~", quando: "—", vazado: true,
    rotulo: semRevisao === alertas.length ? "Ainda não revisado"
      : semRevisao === 1 ? "Um dos motivos ainda não foi revisado" : `${semRevisao} dos motivos ainda não foram revisados`,
    fonte: "É o estado da maior parte dos alertas e não indica culpa nem inocência" });
  return itens.sort((x, y) => x.ordem < y.ordem ? -1 : x.ordem > y.ordem ? 1 : 0);
}

// ------------------------------------------------------------------ plenário (testado no Node)

// as datas das sessões: resumo.json guarda a primeira e, depois, quantos dias até a seguinte
function datasDasSessoes(sessoes) {
  if (!sessoes || !sessoes.length) return [];
  let t = Date.parse(`${sessoes[0]}T00:00:00Z`);
  return [sessoes[0], ...sessoes.slice(1).map(dias => new Date(t += dias * 864e5).toISOString().slice(0, 10))];
}

const PROVISORIO = 45;  // dias: as justificativas de ausência chegam até 45 dias depois da sessão

// a presença de cada mês (índice em `meses`) a partir de 'pr' (um código por sessão, CODIGOS em presenca.py) e das
// datas das sessões: {s (dias com sessão), p (presente), j (ausência justificada), f (falta sem justificativa), fora
// (sem registro: fora do exercício), faltas (dd/mm das faltas), prov (tem sessão nos 45 dias antes de `ate`)}; null
// no mês sem sessão (recesso, ou presença ainda não publicada). Mês com sessão e sem registro nenhum é o fora do
// exercício: o mês todo, nunca um dia solto (que pode ser só uma falha de vínculo). `ate`: a data da geração
// (resumo.json, edicao), porque a coleta baixa de novo os 45 dias antes do dia em que roda
function presencaPorMes(pr, datas, meses, ate) {
  const indice = new Map(meses.map((m, i) => [m, i])), lista = meses.map(() => null);
  const limite = ate ? new Date(Date.parse(`${ate}T00:00:00Z`) - PROVISORIO * 864e5).toISOString().slice(0, 10) : null;
  datas.forEach((data, k) => {
    const i = indice.get(+data.slice(0, 7).replace("-", ""));
    if (i === undefined || k >= pr.length) return;
    const m = lista[i] || (lista[i] = { s: 0, p: 0, j: 0, f: 0, fora: 0, faltas: [], prov: false });
    const c = pr[k];
    m.s++;
    if (c === "P" || c === "p") m.p++;
    else if (c === "F") { m.f++; m.faltas.push(`${data.slice(8)}/${data.slice(5, 7)}`); }
    else if (c === "-") m.fora++;
    else m.j++;
    if (limite && data >= limite) m.prov = true;
  });
  return lista;
}

// ------------------------------------------------------------------ página

const GRAV = { 3: "Alta", 2: "Média", 1: "Baixa" };
const pill = g => `<span class="pill g${g}">${GRAV[g]}</span>`;
const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
const maiuscula = s => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n, um, varios) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

function topoBonito(v) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1)))), r = v / p;
  return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(k => k >= r) * p;
}

// o que cada <article> da lista de alertas diz: chave, gravidade, título, link da página permanente, veredito e, para o
// painel, a regra, o motivo, o valor envolvido e a revisão (o HTML do gerador, já escapado e sem CPF)
function lerAlertasDaPagina() {
  return [...document.querySelectorAll("#lista-alertas-deputado article.alerta")].map(art => {
    const link = art.querySelector("h3 a"), revisao = art.querySelector(".revisao");
    return { el: art, chave: art.dataset.chave, g: +art.dataset.g || 1, titulo: link ? link.textContent : "Alerta",
      href: link ? link.getAttribute("href") : null,
      veredito: revisao ? (["confirmado", "inconclusivo"].find(v => revisao.classList.contains(v)) || "") : "",
      regra: art.dataset.regra || "", desc: (art.querySelector(".desc") || {}).textContent || "",
      valor: (art.querySelector(".valor-alerta") || {}).textContent || "", revisaoHtml: revisao ? revisao.innerHTML : "" };
  });
}

// <dialog> modal: sem ele (navegador antigo), os itens levam à página permanente do alerta, como antes do painel
const temPainel = () => typeof HTMLDialogElement === "function" && "showModal" in HTMLDialogElement.prototype;

function iniciar(dados, opcoes = {}) {
  const $ = s => document.querySelector(s);
  const caixa = $("#mensal"), faixa = $("#mes"), cartao = $("#cartao-mes"), recorte = $("#recorte"), plen = $("#plenario");
  if (!caixa || !faixa || !cartao || !recorte) return null;
  const meses = dados.meses, N = meses.length, parciais = dados.parciais || 0;
  const JANELAS = janelas(meses);
  // tocado: a pessoa já escolheu um mês (a chegada dos dados não muda a escolha). citadas: as linhas de 'd' citadas
  // em algum alerta; regras: dados/regras.json (a explicação de cada regra, no painel); categorias e linkNota: do app.js
  const est = { janela: JANELAS[0], sel: N - 1, todosForn: false, M: null, detalhe: null, tocado: false,
    citadas: new Set(), regras: null, categorias: null, linkNota: null, plen: null, presencaAte: null };
  const FINO = matchMedia("(pointer: fine)");
  const despesasNoMes = Array(N).fill(0);
  const dica = document.createElement("div");
  dica.className = "dica"; dica.hidden = true;
  ["#lt-legenda", "#lt-controles", "#lt-faixa", "#lt-mais"].forEach(s => { if ($(s)) $(s).hidden = false; });
  const anuncio = $("#lt-anuncio");

  const geo = W => {
    const estreito = W < 560, m = { e: 58, d: 8 };
    const { i0, i1 } = est.janela, n = i1 - i0 + 1, pw = W - m.e - m.d, passo = pw / n;
    return { W, estreito, m, i0, i1, n, pw, passo, x: i => m.e + (i - i0 + .5) * passo };
  };
  const pontosDe = i => (est.M ? est.M.pontos[i] : null) || [];
  // largura útil e margem esquerda do gráfico (o espaçamento muda no celular)
  const interno = () => {
    const css = getComputedStyle(caixa);
    return { esq: parseFloat(css.paddingLeft) || 0, largura: caixa.clientWidth - (parseFloat(css.paddingLeft) || 0) - (parseFloat(css.paddingRight) || 0) };
  };

  // ---- gráfico
  // o SVG do gráfico de gastos numa largura W, sem a seleção nem o alvo do toque: a página e o arquivo para matéria
  function corpoDoGrafico(W) {
    const G = geo(W), { m, i0, i1, passo, x } = G;
    const pT = 12, pH = G.estreito ? 132 : 176;
    let topo = 1;
    for (let i = i0; i <= i1; i++) topo = Math.max(topo, dados.valores[i], dados.limites ? dados.limites[i] || 0 : 0);
    topo = topoBonito(topo);
    const y = v => pT + pH - Math.max(v, 0) / topo * pH;
    const r = limitar(passo * .34, 3, 5.5), passoP = 2 * r + 2.5;
    const xY = pT + pH + 16, lrY = xY + 20, lT = lrY + 7, lH = POR_MES * passoP + 6, H = lT + lH + 2;
    let s = `<defs><pattern id="lt-hachura" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
      + `<line class="hachura-traco" x1="0" y1="0" x2="0" y2="6"/></pattern></defs>`;
    [0, .5, 1].forEach(f => {
      const yy = y(topo * f).toFixed(1);
      s += `<line class="grade" x1="${m.e}" x2="${W - m.d}" y1="${yy}" y2="${yy}"/><text class="eixo" x="${m.e - 6}" y="${(+yy + 4).toFixed(1)}" text-anchor="end">${f ? brlCurto(topo * f).replace("R$ ", "") : "0"}</text>`;
    });
    const p0 = Math.max(i0, N - parciais);
    if (parciais && p0 <= i1) s += `<rect fill="url(#lt-hachura)" x="${(x(p0) - passo / 2).toFixed(1)}" y="${pT}" width="${((i1 - p0 + 1) * passo).toFixed(1)}" height="${pH}"/>`;
    const pts = [];
    for (let i = i0; i <= i1; i++) pts.push([x(i), y(dados.valores[i])]);
    const linha = pts.map((p, k) => `${k ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
    s += `<path fill="var(--verde)" fill-opacity=".1" d="${linha}L${pts[pts.length - 1][0].toFixed(1)},${y(0)}L${pts[0][0].toFixed(1)},${y(0)}Z"/><path class="linha-g" d="${linha}"/>`;
    if (dados.limites) {
      let lp = "";
      for (let i = i0; i <= i1; i++) {
        const yy = y(dados.limites[i] || 0).toFixed(1);
        lp += `${i === i0 ? "M" : "L"}${(x(i) - passo / 2).toFixed(1)},${yy}L${(x(i) + passo / 2).toFixed(1)},${yy}`;
      }
      s += `<path class="limite-g" d="${lp}"/>`;
    }
    for (let i = i0; i <= i1; i++) {
      const mes = meses[i] % 100;
      if (!est.janela.id) {
        if (i === i0 || mes === 1) s += `<text class="eixo" x="${(x(i) - passo / 2).toFixed(1)}" y="${xY}">${Math.floor(meses[i] / 100)}</text>`;
      } else {
        const t = passo >= 30 ? MESES[mes - 1] : MESES[mes - 1][0].toUpperCase();
        s += `<text class="eixo" x="${x(i).toFixed(1)}" y="${xY}" text-anchor="middle">${t}</text>`;
      }
    }
    s += `<text class="eixo forte" x="${m.e}" y="${lrY}">Notas com indício próprio</text>`;
    s += `<rect class="trilho" x="${m.e}" y="${lT}" width="${G.pw.toFixed(1)}" height="${lH.toFixed(1)}" rx="6"/>`;
    let algum = false;
    for (let i = i0; i <= i1; i++) {
      const l = pontosDe(i);
      if (!l.length) continue;
      algum = true;
      l.slice(0, POR_MES).forEach((p, k) => {
        const cy = lT + lH - 3 - r - k * passoP, cx = x(i);
        if (k === POR_MES - 1 && l.length > POR_MES) s += `<text class="mais" x="${cx.toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="middle">+</text>`;
        else if (p.tipo === "dia") s += `<rect class="pt g${p.g}" x="${(cx - r * .8).toFixed(1)}" y="${(cy - r * .8).toFixed(1)}" width="${(r * 1.6).toFixed(1)}" height="${(r * 1.6).toFixed(1)}" transform="rotate(45 ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`;
        else s += `<circle class="pt g${p.g}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(p.g === 1 ? r - .6 : r).toFixed(1)}"/>`;
      });
    }
    if (!algum) s += `<text class="eixo" x="${(m.e + G.pw / 2).toFixed(1)}" y="${(lT + lH / 2 + 4).toFixed(1)}" text-anchor="middle">${est.M ? "Nenhuma nota com indício próprio neste período" : "Carregando…"}</text>`;
    Object.assign(G, { r, passoP });  // o clique acha o ponto da pilha pela altura (pontoNoClique)
    return { s, G, H, pT, lT, lH };
  }

  function desenhar() {
    const W = Math.max(260, Math.round(interno().largura));
    const { s: corpo, G, H, pT, lT, lH } = corpoDoGrafico(W), { i0, i1 } = G;
    let s = corpo;
    s += `<line class="sel" x1="0" x2="0" y1="${pT}" y2="${(lT + lH).toFixed(1)}"/>`;
    s += `<rect class="alvo" x="0" y="0" width="${W}" height="${H.toFixed(0)}"/>`;
    caixa.innerHTML = `<svg viewBox="0 0 ${W} ${H.toFixed(0)}" role="img" aria-labelledby="lt-desc">${s}</svg>`;
    caixa.appendChild(dica);
    G.lT = lT; G.lH = lH;  // o trilho: no computador, o clique num ponto dele abre o painel
    caixa._G = G; caixa._largura = caixa.clientWidth;
    let pico = i0;
    for (let i = i0; i <= i1; i++) if (dados.valores[i] > dados.valores[pico]) pico = i;
    const comPonto = [];
    for (let i = i0; i <= i1; i++) if (pontosDe(i).length) comPonto.push(i);
    $("#lt-desc").textContent = `Gráfico dos reembolsos de ${nomeMesLongo(meses[i0])} a ${nomeMesLongo(meses[i1])}, com pico em `
      + `${nomeMesLongo(meses[pico])} (${brl(dados.valores[pico])}). `
      + (est.M ? (comPonto.length ? `Notas com indício próprio em ${plural(comPonto.length, "mês", "meses")}. ` : "Nenhuma nota com indício próprio neste período. ") : "")
      + "Use o controle Mês escolhido, mais abaixo, para percorrer os meses.";
    desenharPlenario();
    posicionarSel();
    ajustarFaixa();
    if (est.M) desenharMinis();
  }

  // ---- plenário: barras dos dias de sessão de cada mês (presente, justificada, falta), na mesma geometria do gráfico
  // de gastos; faltas em tinta neutra, não em vermelho; o mês inteiro sem registro sombreado como fora do exercício; os
  // meses dos últimos 45 dias esmaecidos (as justificativas ainda chegam)
  function desenharPlenario() {
    const G = caixa._G, L = est.plen;
    if (!plen || !G || !L) return;
    const { W, m, i0, i1, passo, x } = G;
    const pT = 20, pH = G.estreito ? 48 : 60, H = pT + pH + 4;
    let topo = 1;
    for (let i = i0; i <= i1; i++) if (L[i]) topo = Math.max(topo, L[i].s);
    const y = v => pT + pH - v / topo * pH, bw = limitar(passo * .62, 2, 18);
    let s = `<defs><pattern id="pl-hachura" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
      + `<rect width="4" height="4" class="b-just"/><line class="hachura-traco" x1="0" y1="0" x2="0" y2="4"/></pattern></defs>`;
    s += `<text class="eixo forte" x="${m.e}" y="12">Plenário: dias de sessão</text>`;
    s += `<line class="grade" x1="${m.e}" x2="${W - m.d}" y1="${y(0)}" y2="${y(0)}"/>`;
    s += `<text class="eixo" x="${m.e - 6}" y="${(y(topo) + 4).toFixed(1)}" text-anchor="end">${topo}</text>`;
    for (let i = i0; i <= i1; i++) {
      const p = L[i];
      if (!p) continue;
      if (p.fora === p.s) {
        s += `<rect class="b-fora" x="${(x(i) - passo / 2).toFixed(1)}" y="${pT}" width="${passo.toFixed(1)}" height="${pH}"/>`;
        continue;
      }
      let base = 0, g = "";
      [[p.p, "b-pres"], [p.j, "b-just"], [p.f, "b-falta"]].forEach(([v, classe]) => {
        if (!v) return;
        const y1 = y(base + v), y0 = y(base);
        g += `<rect class="${classe}"${classe === "b-just" ? ` style="fill:url(#pl-hachura)"` : ""} x="${(x(i) - bw / 2).toFixed(1)}" `
          + `y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${(y0 - y1).toFixed(1)}"/>`;
        base += v;
      });
      s += `<g${p.prov ? ` class="prov"` : ""}>${g}</g>`;
    }
    s += `<line class="sel" x1="0" x2="0" y1="${pT}" y2="${pT + pH}"/><rect class="alvo" x="0" y="0" width="${W}" height="${H}"/>`;
    plen.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="pl-desc">${s}</svg>`;
    const soma = { s: 0, p: 0, j: 0, f: 0, fora: 0 };
    for (let i = i0; i <= i1; i++) if (L[i]) Object.keys(soma).forEach(k => { soma[k] += L[i][k]; });
    const exercicio = soma.s - soma.fora;
    $("#pl-desc").textContent = exercicio
      ? `Presença no Plenário de ${nomeMesLongo(meses[i0])} a ${nomeMesLongo(meses[i1])}: presente em ${plural(soma.p, "dia", "dias")}, `
        + `${plural(soma.j, "ausência justificada", "ausências justificadas")} e ${plural(soma.f, "falta sem justificativa", "faltas sem justificativa")}, `
        + `em ${plural(exercicio, "dia de sessão", "dias de sessão")} em exercício. O cartão do mês escolhido traz os números de cada mês.`
      : "Sem registro de presença no Plenário neste período.";
  }

  // a linha do Plenário no cartão do mês (e no painel do mês)
  function plenarioDoMes(i) {
    if (!est.plen) return "";
    const p = est.plen[i];
    if (!p) return est.presencaAte && meses[i] > +est.presencaAte.slice(0, 7).replace("-", "")
      ? "Plenário: presença ainda não publicada pela Câmara" : "Plenário: sem sessão deliberativa neste mês";
    if (p.fora === p.s) return "Plenário: fora do exercício neste mês (sem registro de presença)";
    const partes = [`presente em ${p.p} de ${plural(p.s - p.fora, "dia de sessão", "dias de sessão")}`];
    if (p.j) partes.push(plural(p.j, "ausência justificada", "ausências justificadas"));
    if (p.f) partes.push(`${plural(p.f, "falta", "faltas")} sem justificativa (${p.faltas.join(", ")})`);
    return `Plenário: ${partes.join(", ")}${p.fora ? `; fora do exercício em ${plural(p.fora, "dia", "dias")}` : ""}${p.prov ? " · ainda pode mudar" : ""}`;
  }

  function posicionarSel() {
    const G = caixa._G;
    if (!G) return;
    const dentro = est.sel >= G.i0 && est.sel <= G.i1;
    [caixa, plen].forEach(c => {
      const linha = c && c.querySelector(".sel");
      if (!linha) return;
      linha.style.display = dentro ? "" : "none";
      if (dentro) { linha.setAttribute("x1", G.x(est.sel).toFixed(1)); linha.setAttribute("x2", G.x(est.sel).toFixed(1)); }
    });
  }

  // o controle deslizante fica alinhado com as colunas do gráfico
  function ajustarFaixa() {
    const G = caixa._G, { i0, i1 } = est.janela;
    faixa.min = i0; faixa.max = i1; faixa.value = est.sel;
    faixa.setAttribute("aria-valuetext", textoMes(est.sel));
    const svg = caixa.querySelector("svg");
    if (!G || !svg) return;
    // o polegar (28 px, estilo.css) fica sobre a coluna do mês, do primeiro ao último, sem passar da caixa
    const r = svg.getBoundingClientRect(), escala = r.width / G.W, caixaFaixa = faixa.parentElement.getBoundingClientRect();
    const esq = Math.max(0, r.left - caixaFaixa.left + (G.m.e + G.passo / 2) * escala - 14);
    faixa.style.marginLeft = `${esq}px`;
    faixa.style.width = `${Math.max(120, Math.min((G.pw - G.passo) * escala + 28, caixaFaixa.width - esq))}px`;
  }

  function mesNoPonto(ev) {
    const G = caixa._G, svg = caixa.querySelector("svg");
    if (!G || !svg) return null;
    const caixaSvg = svg.getBoundingClientRect(), escala = caixaSvg.width / G.W;
    const px = (ev.clientX - caixaSvg.left) / escala, py = (ev.clientY - caixaSvg.top) / escala;
    let i = limitar(Math.floor((px - G.m.e) / G.passo) + G.i0, G.i0, G.i1);
    // perto de um mês com nota, o toque vai para ele (os pontos são pequenos no celular)
    const raio = Math.max(12, G.passo / 2);
    let melhor = null;
    for (let j = G.i0; j <= G.i1; j++) {
      if (!pontosDe(j).length) continue;
      const dist = Math.abs(G.x(j) - px);
      if (dist <= raio && (melhor === null || dist < Math.abs(G.x(melhor) - px))) melhor = j;
    }
    return { i: melhor ?? i, px, py, escala };
  }

  // ---- mês escolhido
  function textoMes(i) {
    const n = pontosDe(i).length;
    return `${nomeMesLongo(meses[i])}: ${brl(dados.valores[i])}${n ? `, ${plural(n, "indício próprio", "indícios próprios")}` : ""}`;
  }

  function linkAlerta(k) {
    const x = est.M.dados[k];
    return x && x.href ? x.href : "#alertas";
  }

  // o que um item abre no painel ("nota:<código do documento>", "alerta:<chave>", "forn:<chave>"), e o endereço que
  // vale sozinho (nova aba, ou se o JS do painel falhar: o perfil.js abre o painel pelo endereço)
  const hrefDe = abre => `#${abre.replace(":", "=")}`;
  function abreDoPonto(p) {
    const ide = est.detalhe.d[p.linha][6];
    return p.tipo === "nota" && ide ? `nota:${ide}` : `alerta:${est.detalhe.a[p.tipo === "nota" ? p.alertas[0] : p.k][0]}`;
  }
  // o fornecedor no endereço: o CNPJ; quem não tem CNPJ inteiro (pessoa física, CPF mascarado) ou não tem nota ligada
  // vai pela chave do primeiro alerta do grupo
  function chaveDoGrupo(gr) {
    const f = gr.forn >= 0 ? est.detalhe.f[gr.forn] : null, doc = f ? String(f[1]).replace(/\D/g, "") : "";
    return doc.length === 14 ? doc : est.detalhe.a[gr.alertas[0]][0];
  }

  function itemPonto(p) {
    const D = est.detalhe, r = D.d[p.linha], forn = D.f[r[3]] ? D.f[r[3]][0] : "";
    const ks = p.tipo === "nota" ? p.alertas : [p.k], x = est.M.dados[ks[0]];
    const mais = ks.length > 1 ? ` <span class="it-mais">e mais ${plural(ks.length - 1, "indício", "indícios")}</span>` : "";
    const texto = p.tipo === "nota"
      ? `<b>${esc(r[1] || nomeMes(meses[r[0]]))}</b> · ${esc(forn)}<br><small>${esc(x.titulo)}${mais}</small>`
      : `<b>${plural(p.n, "nota", "notas")} no mesmo dia</b><br><small>${esc(x.titulo)}</small>`;
    const abre = painel ? abreDoPonto(p) : "";
    return `<li><a class="item" href="${esc(abre ? hrefDe(abre) : linkAlerta(ks[0]))}"${abre ? ` data-abre="${esc(abre)}"` : ""}>`
      + `${pill(p.g)}<span class="it-txt">${texto}</span>`
      + `<span class="it-v">${brl2(p.valor)}</span><span class="seta" aria-hidden="true"></span></a></li>`;
  }

  function itemFornecedorDoMes(gr, k, i) {
    const alvo = painel ? `data-abre="${esc(`forn:${chaveDoGrupo(gr)}`)}"` : `data-grupo="${k}"`;
    return `<li><button type="button" class="item" ${alvo}>${pill(gr.g)}<span class="it-txt">${esc(nomeForn(gr))}</span>`
      + `<span class="it-v">${plural(gr.meses.get(i), "nota", "notas")}</span><span class="seta" aria-hidden="true"></span></button></li>`;
  }

  // o resumo e as listas do mês: as mesmas no cartão (h5) e no painel (h3)
  function resumoDoMes(i) {
    const v = dados.valores[i], lim = dados.limites ? dados.limites[i] : 0;
    return `${brl(v)}${lim ? ` · ${Math.round(v / lim * 100)}% do limite da cota` : ""}`
      + (est.detalhe ? ` · ${plural(despesasNoMes[i], "despesa", "despesas")}` : "") + (i >= N - parciais ? " · mês ainda incompleto" : "");
  }
  function listasDoMes(i, h) {
    const l = pontosDe(i), grupos = est.M.grupos.map((gr, k) => [gr, k]).filter(([gr]) => gr.meses.has(i));
    return `<${h}>Notas com indício próprio (${l.length})</${h}>
      ${l.length ? `<ul class="itens">${l.map(itemPonto).join("")}</ul>` : `<p class="lt-vazio">Nenhuma neste mês.</p>`}
      <${h}>Fornecedores com indício que receberam neste mês (${grupos.length})</${h}>
      ${grupos.length ? `<ul class="itens">${grupos.map(([gr, k]) => itemFornecedorDoMes(gr, k, i)).join("")}</ul>` : `<p class="lt-vazio">Nenhum neste mês.</p>`}`;
  }

  function desenharCartao() {
    const i = est.sel;
    const lista = est.M ? est.M.comIndicio : [];
    const antes = [...lista].reverse().find(m => m < i && m >= est.janela.i0), depois = lista.find(m => m > i && m <= est.janela.i1);
    const resumo = resumoDoMes(i);
    const corpo = !est.M ? `<p class="lt-vazio">Carregando os indícios…</p>` : `${listasDoMes(i, "h5")}
      <div class="cartao-acoes">
      ${despesasNoMes[i] ? `<button type="button" class="botao secundario pequeno ver-despesas">Ver as ${plural(despesasNoMes[i], "despesa", "despesas")} de ${nomeMes(meses[i])}</button>` : ""}
      ${painel ? `<button type="button" class="botao secundario pequeno" data-copiar-link="mes:${meses[i]}" data-rotulo="Copiar link deste mês">Copiar link deste mês</button>` : ""}</div>`;
    cartao.innerHTML = `
      <div class="cartao-cab">
        <button type="button" class="nav-mes" data-ir="${antes ?? ""}" aria-label="Mês anterior com indício"${antes === undefined ? " disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button>
        <h4 id="cartao-titulo" tabindex="-1">${maiuscula(nomeMesLongo(meses[i]))}</h4>
        <button type="button" class="nav-mes" data-ir="${depois ?? ""}" aria-label="Próximo mês com indício"${depois === undefined ? " disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>
      </div>
      <p class="cartao-resumo">${resumo}</p>${plenarioDoMes(i) ? `<p class="cartao-plenario">${esc(plenarioDoMes(i))}</p>` : ""}${corpo}`;
  }

  // ---- fornecedores com indício
  function nomeForn(gr) {
    if (gr.forn < 0) return "Sem nota fiscal ligada";
    const f = est.detalhe.f[gr.forn];
    return f ? f[0] : "Fornecedor";
  }

  function desenharFornecedores() {
    const ul = $("#forn-indicio"), botao = $("#forn-mais");
    if (!est.M) return;
    const todos = est.M.grupos, lista = est.todosForn ? todos : todos.slice(0, 5);
    if (!todos.length) {
      ul.innerHTML = `<li class="lt-vazio">Nenhum indício no padrão de relação com fornecedor.</li>`;
      botao.hidden = true;
      return;
    }
    const abertos = new Set([...ul.querySelectorAll("details[open]")].map(x => x.id));
    ul.innerHTML = lista.map((gr, k) => {
      const tem = gr.meses.has(est.sel), n = gr.alertas.length;
      const meta = gr.linhas.length
        ? `${plural(n, "alerta", "alertas")} · notas de ${nomeMes(meses[gr.m0])} a ${nomeMes(meses[gr.m1])} · ${brlCurto(gr.total)} em ${plural(gr.linhas.length, "nota citada", "notas citadas")}`
        : plural(n, "alerta", "alertas");
      return `<li><details class="forn" id="forn-${k}"${abertos.has(`forn-${k}`) ? " open" : ""}><summary>
        <span class="forn-l1">${pill(gr.g)}<span class="forn-nome">${esc(nomeForn(gr))}${gr.varias ? "<small> e outras empresas</small>" : ""}</span>`
        + `<span class="forn-tag"${tem ? "" : " hidden"}>notas em ${MESES[meses[est.sel] % 100 - 1]}</span></span>
        <span class="forn-meta">${meta}</span>
        ${gr.confirmados ? `<span class="forn-rev">${plural(gr.confirmados, "alerta confirmado", "alertas confirmados")} na revisão</span>` : ""}
        <svg class="mini" aria-hidden="true" data-grupo="${k}" preserveAspectRatio="none"></svg></summary>
        <ul class="forn-alertas">${gr.alertas.map(ka => { const x = est.M.dados[ka]; return `<li>${pill(x.g)} <a href="${esc(linkAlerta(ka))}"${painel ? ` data-abre="alerta:${esc(x.chave)}"` : ""}>${esc(x.titulo)}</a>`
          + `${x.veredito ? ` <span class="cat">(${x.veredito})</span>` : ""}</li>`; }).join("")}
          ${painel ? `<li class="forn-abrir"><button type="button" class="botao secundario pequeno" data-abre="${esc(`forn:${chaveDoGrupo(gr)}`)}">Ver o fornecedor no painel</button></li>` : ""}</ul></details></li>`;
    }).join("");
    const resto = todos.length - 5;
    botao.hidden = resto <= 0;
    botao.textContent = est.todosForn ? "Mostrar só os 5 principais" : `Mostrar os outros ${plural(resto, "fornecedor", "fornecedores")}`;
    botao.setAttribute("aria-expanded", String(est.todosForn));
    desenharMinis();
  }

  // a faixa de meses de cada fornecedor: os mesmos meses do gráfico (recorte incluído), esticados na largura da faixa
  function desenharMinis() {
    const G = caixa._G;
    if (!G) return;
    document.querySelectorAll("#forn-indicio svg.mini").forEach(svg => {
      const gr = est.M.grupos[+svg.dataset.grupo];
      let s = `<line class="msel" x1="0" x2="0" y1="0" y2="14"/>`;
      for (let i = G.i0; i <= G.i1; i++) {
        if (gr.meses.has(i)) s += `<rect class="mg${gr.g}" x="${(G.x(i) - G.passo * .4).toFixed(1)}" y="3" width="${Math.max(1.5, G.passo * .8).toFixed(1)}" height="8" rx="1.5"/>`;
      }
      svg.setAttribute("viewBox", `${G.m.e} 0 ${G.pw.toFixed(1)} 14`);
      svg.innerHTML = s;
    });
    marcarMesNosFornecedores();
  }

  // quando o mês muda, só a etiqueta "notas em ..." e a linha do mês mudam: o controle deslizante não redesenha a lista
  function marcarMesNosFornecedores() {
    const G = caixa._G;
    if (!G || !est.M) return;
    const dentro = est.sel >= G.i0 && est.sel <= G.i1, xx = G.x(est.sel).toFixed(1);
    document.querySelectorAll("#forn-indicio details.forn").forEach(det => {
      const gr = est.M.grupos[+det.id.slice(5)], tag = det.querySelector(".forn-tag"), linha = det.querySelector(".msel");
      if (tag) { tag.hidden = !gr.meses.has(est.sel); tag.textContent = `notas em ${MESES[meses[est.sel] % 100 - 1]}`; }
      if (linha) { linha.style.display = dentro ? "" : "none"; linha.setAttribute("x1", xx); linha.setAttribute("x2", xx); }
    });
  }

  // ---- tabela: as mesmas notas, em lista (leitor de tela, impressão, quem prefere ler)
  function desenharTabela() {
    const tabela = $("#tab-indicios");
    if (!tabela || !est.M) return;
    const D = est.detalhe, todos = est.M.pontos.flat().sort((p, q) => p.linha - q.linha);
    tabela.innerHTML = `<tr><th>Data</th><th>Fornecedor</th><th>Indício</th><th class="n">Valor</th></tr>` + (todos.length
      ? todos.map(p => {
        const r = D.d[p.linha], ks = p.tipo === "nota" ? p.alertas : [p.k];
        const quando = p.tipo === "nota" ? (r[1] || nomeMes(meses[r[0]])) : `${nomeMes(meses[p.mes])} (${plural(p.n, "nota", "notas")})`;
        const abre = painel ? abreDoPonto(p) : "";
        return `<tr><td class="mono">${abre ? `<a href="${esc(hrefDe(abre))}" data-abre="${esc(abre)}">${esc(quando)}</a>` : esc(quando)}</td>`
          + `<td>${p.tipo === "nota" ? esc(D.f[r[3]] ? D.f[r[3]][0] : "") : "—"}</td>`
          + `<td>${ks.map(k => `${pill(est.M.dados[k].g)} <a href="${esc(linkAlerta(k))}"${painel ? ` data-abre="alerta:${esc(est.M.dados[k].chave)}"` : ""}>${esc(est.M.dados[k].titulo)}</a>`).join("<br>")}</td>`
          + `<td class="n">${brl2(p.valor)}</td></tr>`;
      }).join("")
      : `<tr><td colspan="4" class="vazio">Nenhuma nota com indício próprio.</td></tr>`);
  }

  // ---- estado
  // anunciar: o leitor de tela diz o mês novo (pelo controle deslizante, quem diz é o aria-valuetext)
  function escolher(i, anunciar = false) {
    est.sel = limitar(i, 0, N - 1);
    est.tocado = true;
    faixa.value = est.sel;
    faixa.setAttribute("aria-valuetext", textoMes(est.sel));
    posicionarSel();
    desenharCartao();
    marcarMesNosFornecedores();
    if (anunciar && anuncio) anuncio.textContent = `${textoMes(est.sel)}${plenarioDoMes(est.sel) ? `. ${plenarioDoMes(est.sel)}` : ""}`;
  }

  function mudarJanela(j, manterMes = true) {
    est.janela = j;
    recorte.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.janela === j.id)));
    if (!manterMes || est.sel < j.i0 || est.sel > j.i1) est.sel = mesInicial(meses, est.M ? est.M.pontos : [], j.id);
    desenharTudo();
  }

  function desenharTudo() {
    desenhar();
    desenharCartao();
    desenharFornecedores();
  }

  // o mês na página: fora do recorte, volta para "Tudo"
  function mostrarMes(i) {
    if (i < est.janela.i0 || i > est.janela.i1) { est.sel = i; est.tocado = true; mudarJanela(JANELAS[0]); }
    else escolher(i);
  }

  // dados/regras.json: a explicação de cada regra no painel. Sem o ?v= da geração, o navegador guarda entre os perfis;
  // se demorar, o painel abre sem ela
  let regrasPedidas = null;
  // ---- E8: o pacote CSV dos indícios e o gráfico do período escolhido em SVG, prontos para matéria
  const secao = $("#linha-do-tempo"), baixar = $("#lt-baixar");
  const titulo = () => (secao && secao.dataset.titulo) || "";
  const dataBr = iso => iso ? iso.slice(0, 10).split("-").reverse().join("/") : "";
  function baixarArquivo(nome, tipo, texto) {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([texto], { type: tipo })), download: nome });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function baixarPacote() {
    // os endereços do arquivo são os oficiais (data-url), não os de onde a página foi aberta (cópia, arquivo salvo)
    const tmp = document.createElement("div"), base = (secao && secao.dataset.url) || location.href.split("#")[0];
    const dadosCsv = est.M.dados.map(x => x && { ...x,
      revisao: x.revisaoHtml ? (tmp.innerHTML = x.revisaoHtml, tmp.textContent.replace(/\s+/g, " ").trim()) : "",
      pagina: x.href ? new URL(x.href, base).href : "" });
    const linhas = linhasDoPacote(est.detalhe.a || [], est.detalhe.d, est.detalhe.f, dadosCsv,
      { meses, categorias: est.categorias, linkNota: est.linkNota, nomeMes, base });
    baixarCSV(`indicios-${arquivo(titulo())}-${est.edicao || "dados"}.csv`, CABECALHO_PACOTE, linhas);
    avisarNoBotao($("#lt-csv"), "Planilha baixada");
  }
  function baixarGrafico() {
    const W = 960, { s, H } = corpoDoGrafico(W), { i0, i1 } = est.janela;
    let mais = false;
    for (let i = i0; i <= i1; i++) mais = mais || pontosDe(i).length > POR_MES;
    const texto = svgParaMateria(s, W, H, { titulo: titulo(), edicao: dataBr(est.edicao) || "—", mais,
      periodo: i0 === i1 ? nomeMesLongo(meses[i0]) : `de ${nomeMesLongo(meses[i0])} a ${nomeMesLongo(meses[i1])}`,
      url: (secao && secao.dataset.url) || location.href.split("#")[0], parcial: !!parciais && i1 >= N - parciais });
    baixarArquivo(`grafico-${arquivo(titulo())}-${est.janela.id || "tudo"}-${est.edicao || "dados"}.svg`, "image/svg+xml;charset=utf-8", texto);
    avisarNoBotao($("#lt-svg"), "Gráfico baixado");
  }
  if (baixar) {
    $("#lt-csv").addEventListener("click", baixarPacote);
    $("#lt-svg").addEventListener("click", baixarGrafico);
  }

  // ---- E8: novo desde a última visita. O navegador guarda, por deputado, o retrato dos alertas vistos (códigos e
  // quantos eventos; nada vai ao servidor). Um aviso discreto diz isso e deixa recusar (ou voltar a aceitar)
  const CHAVE_VISITA = `cidadania:visita:${dados.id}`, SEM_VISITAS = "cidadania:sem-visitas";
  const guardado = {
    ler(k) { try { return localStorage.getItem(k); } catch { return null; } },
    gravar(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    esquecer() { try { Object.keys(localStorage).filter(k => k.startsWith("cidadania:visita:")).forEach(k => localStorage.removeItem(k)); localStorage.setItem(SEM_VISITAS, "1"); } catch {} },
    lembrar() { try { localStorage.removeItem(SEM_VISITAS); } catch {} },
  };
  function marcarNovidades() {
    const lista = $("#lista-alertas-deputado");
    if (!est.edicao || !lista) return;
    const aviso = Object.assign(document.createElement("p"), { className: "aviso-visitas cat" });
    lista.after(aviso);
    const mostrarAviso = () => {
      const recusou = !!guardado.ler(SEM_VISITAS);
      aviso.innerHTML = (recusou ? "Este navegador não lembra as suas visitas a este perfil. "
        : "Este navegador lembra os alertas que você já viu neste perfil, para marcar o que é novo; nada vai para o site. ")
        + `<button type="button" class="fi-link">${recusou ? "Voltar a lembrar" : "Não lembrar"}</button>`;
      aviso.querySelector("button").addEventListener("click", () => {
        if (recusou) { guardado.lembrar(); gravarRetrato(); } else { guardado.esquecer(); apagarMarcas(); }
        mostrarAviso();
        aviso.querySelector("button").focus();
      });
    };
    const retrato = retratoDosAlertas(est.detalhe.a, est.detalhe.h);
    const gravarRetrato = () => guardado.gravar(CHAVE_VISITA, JSON.stringify({ e: est.edicao, a: retrato }));
    const apagarMarcas = () => { document.querySelectorAll(".pill-novo, .novidades-visita").forEach(el => el.remove()); };
    mostrarAviso();
    if (guardado.ler(SEM_VISITAS)) return;
    let antes = null;
    try { antes = JSON.parse(guardado.ler(CHAVE_VISITA)); } catch {}
    const { gravar, base } = proximaVisita(antes, est.edicao, retrato);
    if (gravar && !guardado.gravar(CHAVE_VISITA, JSON.stringify(gravar))) return;  // sem armazenamento: sem marcas
    const marcas = novidadesDesde(est.detalhe.a, retrato, base);
    let novos = 0, mudaram = 0;
    const recolhidos = new Set();
    marcas.forEach((m, k) => {
      const x = est.M.dados[k];
      if (!m || !x || !x.el) return;
      m === "novo" ? novos++ : mudaram++;
      const h3 = x.el.querySelector("h3");
      if (h3 && !h3.querySelector(".pill-novo")) h3.insertAdjacentHTML("beforeend", ` <span class="pill pill-novo">${m === "novo" ? "novo" : "com novidade"}</span>`);
      const fechado = x.el.closest("details:not([open])");
      if (fechado) recolhidos.add(fechado);
    });
    if (!(novos + mudaram)) return;
    const quando = base.e.slice(0, 10).split("-").reverse().join("/");
    const p = Object.assign(document.createElement("p"), { className: "novidades-visita" });
    p.innerHTML = `<span>Desde a sua última visita (dados de ${quando}): ${[novos ? plural(novos, "alerta novo", "alertas novos") : "",
      mudaram ? `${plural(mudaram, "alerta", "alertas")} com novidade (revisão, gravidade, descrição ou pedido)` : ""].filter(Boolean).join(" e ")}.`
      + `${recolhidos.size ? " Parte deles está na lista recolhida." : ""}</span>`
      + (recolhidos.size ? `<button type="button" class="botao secundario pequeno">Abrir a lista recolhida</button>` : "");
    const abrir = p.querySelector("button");
    if (abrir) abrir.addEventListener("click", () => {
      recolhidos.forEach(d => { d.open = true; });
      const primeiro = [...recolhidos][0].querySelector(".pill-novo");
      abrir.remove();
      if (primeiro) { const art = primeiro.closest("article"); art.tabIndex = -1; art.focus(); }
    });
    lista.before(p);
  }

  function carregarRegras() {
    regrasPedidas = regrasPedidas || Promise.race([
      fetch(`${RAIZ}dados/regras.json`).then(r => r.ok ? r.json() : null).then(j => { if (j) est.regras = j; }).catch(() => {}),
      new Promise(ok => setTimeout(ok, 2500)),
    ]);
    return regrasPedidas;
  }

  // ---- painel: a nota, o alerta, o fornecedor ou o mês, com o motivo e o histórico. Sobe de baixo no celular e abre
  // como gaveta no computador (estilo.css). Cada vista é um endereço (#nota=, #alerta=, #forn=, #mes=, junto com o
  // #per= da tabela) e uma entrada no histórico do navegador: o Voltar volta uma vista ou fecha o painel, e o foco
  // volta ao botão que abriu
  function criarPainel() {
    const caixaP = document.createElement("dialog");
    caixaP.className = "ficha-indicio";
    caixaP.setAttribute("aria-labelledby", "fi-titulo");
    caixaP.innerHTML = `<div class="fi-cab"><button type="button" class="fi-voltar seta-e" hidden>Voltar</button>
      <div class="fi-titulos"><p class="rotulo" id="fi-rotulo"></p><h2 id="fi-titulo" tabindex="-1"></h2></div>
      <button type="button" class="fi-fechar" aria-label="Fechar o painel">×</button></div>
      <div class="fi-corpo" id="fi-corpo"></div><p class="so-impressao fi-endereco"></p><p class="vh" id="fi-anuncio" aria-live="polite"></p>`;
    document.body.appendChild(caixaP);
    // E8: no papel, o endereço desta ficha por extenso (o da página permanente, quando o alerta tem)
    addEventListener("beforeprint", () => {
      const permanente = caixaP.querySelector(".fi-acoes a[href*='alerta/']");
      caixaP.querySelector(".fi-endereco").textContent = `Endereço desta ficha: ${location.href}`
        + (permanente ? ` · página permanente do alerta: ${permanente.href}` : "");
    });
    const rotulo = caixaP.querySelector("#fi-rotulo"), titulo = caixaP.querySelector("#fi-titulo");
    const corpo = caixaP.querySelector("#fi-corpo"), voltar = caixaP.querySelector(".fi-voltar");
    const anuncioP = caixaP.querySelector("#fi-anuncio");  // a região viva da página fica inerte atrás do painel
    // pilha[n]: quem abriu a vista n+1 (para devolver o foco) e como estava a vista n (notas mostradas, rolagem,
    // <details> abertos), para voltar a ela como estava; o tamanho é a profundidade no histórico (state.fi)
    const P = { pilha: [], depois: null, vista: null, limite: 20 };
    const profundidade = () => (history.state && history.state.fi) || 0;
    const descrever = el => el ? { el, abre: (el.dataset && el.dataset.abre) || "" } : null;
    const enderecoDa = vista => enderecoCom(location.hash, { [vista.tipo]: vista.valor });
    const semVista = () => enderecoCom(location.hash, Object.fromEntries(VISTAS.map(v => [v, null])));
    // pushState com "" não muda o endereço: sem hash, o caminho
    const url = hash => hash || location.pathname + location.search;
    const separar = abre => { const k = abre.indexOf(":"); return { tipo: abre.slice(0, k), valor: abre.slice(k + 1) }; };

    function abrir(vista, de) {
      // a entrada da página fica sem fragmento de seção (#presenca, #despesas: ao fechar, o go(-n) voltaria a ela como
      // ida ao fragmento, e a página pularia para a seção) e sem vista (link direto que ainda espera o regras.json)
      if (location.hash && (!location.hash.includes("=") || vistaDoEndereco(location.hash)))
        history.replaceState({ fi: 0 }, "", url(semVista()));
      P.pilha = [descrever(de)]; P.limite = 20;
      history.pushState({ fi: 1 }, "", url(enderecoDa(vista)));
      mostrar();
    }
    function empilhar(vista, de) {
      P.pilha.push({ ...descrever(de), limite: P.limite, rolagem: corpo.scrollTop,
        abertos: [...corpo.querySelectorAll("details")].map(d => d.open) });
      P.limite = 20;
      history.pushState({ fi: P.pilha.length }, "", url(enderecoDa(vista)));
      mostrar();
    }
    // a mesma vista em outro valor, sem entrada nova (os botões de mês anterior e próximo)
    function trocar(vista) {
      history.replaceState(history.state, "", url(enderecoDa(vista)));
      mostrar({ focarTitulo: false });
    }
    // tira do histórico as entradas do painel; `depois` roda quando o endereço já voltou ao da página
    function fechar(depois) {
      P.depois = depois || null;
      const n = profundidade();
      if (n > 0) history.go(-n); else concluir();
    }
    function concluir() {
      const aberto = caixaP.open;
      if (!aberto && !P.pilha.length) return;
      const origem = P.pilha[0], depois = P.depois, vista = P.vista;
      P.pilha = []; P.depois = null; P.vista = null;
      // close() devolve o foco a quem o tinha antes de abrir, na hora: o foco certo vem logo depois. A ação que leva a
      // outro ponto da página espera o navegador restaurar a rolagem da entrada, que vem depois deste popstate
      if (aberto) caixaP.close();
      if (depois) setTimeout(depois, 0); else focarNaPagina(origem, vista);
    }
    // o botão de origem, se ainda está na página; senão (redesenhado), o que abre a mesma vista; senão, o mês. Item
    // dentro de <details> fechado não recebe foco: conta só o que ficou com ele
    function focarNaPagina(origem, vista) {
      const abre = (origem && origem.abre) || (vista ? `${vista.tipo}:${vista.valor}` : "");
      const candidatos = [origem && origem.el,
        ...[...document.querySelectorAll("[data-abre]")].filter(el => abre && el.dataset.abre === abre), $("#cartao-titulo")];
      for (const el of candidatos) {
        if (!el || !el.isConnected || caixaP.contains(el)) continue;
        el.focus();
        if (document.activeElement === el) return;
      }
    }
    // endereço com vista ao abrir a página (ou trocado à mão): a entrada da página fica sem a vista, e o painel ganha
    // uma por cima, para o Voltar fechar o painel e continuar no perfil
    function linkDireto() {
      const vista = vistaDoEndereco(location.hash);
      if (!vista || caixaP.open) return;  // aberto enquanto esperava o regras.json: quem abriu já cuidou do histórico
      const n = profundidade();
      if (n > 0) P.pilha = Array(n).fill(null);  // recarregou com o painel aberto: as entradas já existem
      else {
        const alvo = location.hash;
        history.replaceState({ fi: 0 }, "", url(semVista()));
        history.pushState({ fi: 1 }, "", alvo);
        P.pilha = [null];
      }
      P.limite = 20;
      mostrar();
    }

    // `como`: a vista como estava ao abrir a de cima (pilha), ao voltar a ela
    function mostrar({ focarEm = "", focarTitulo = true, manterRolagem = false, como = null } = {}) {
      const vista = vistaDoEndereco(location.hash);
      if (!vista) return concluir();
      P.vista = vista;
      const rolagem = corpo.scrollTop, v = montarVista(vista);
      rotulo.textContent = v.rotulo;
      titulo.textContent = v.titulo;
      corpo.innerHTML = v.corpo;
      voltar.hidden = P.pilha.length < 2;
      if (como && como.abertos) corpo.querySelectorAll("details").forEach((d, k) => { if (como.abertos[k]) d.open = true; });
      if (!caixaP.open) caixaP.showModal();
      corpo.scrollTop = como && como.rolagem != null ? como.rolagem : manterRolagem ? rolagem : 0;
      const alvo = focarEm && [...corpo.querySelectorAll("[data-abre]")].find(el => el.dataset.abre === focarEm);
      if (alvo) {
        for (let d = alvo.closest("details"); d; d = d.parentElement.closest("details")) d.open = true;
        alvo.focus();
      }
      if ((alvo && document.activeElement !== alvo) || (!alvo && focarTitulo)) titulo.focus();
    }

    function montarVista(v) {
      if (!est.M || !est.detalhe) return { rotulo: "", titulo: "Carregando…", corpo: `<p class="lt-vazio">Carregando os dados do perfil…</p>` };
      try {
        if (v.tipo === "nota") return vistaNota(v.valor);
        if (v.tipo === "alerta") return vistaAlerta(v.valor);
        if (v.tipo === "forn") return vistaFornecedor(v.valor);
        if (v.tipo === "mes") return vistaMes(v.valor);
      } catch (erro) { console.error(erro); }
      return aviso("Não foi possível abrir", "Não deu para montar esta ficha. Recarregue a página ou abra a lista de alertas do perfil.");
    }

    // ---- pedaços das vistas
    const AVISO = `<p class="fi-aviso">Indício não é acusação: é um padrão nos dados que pede explicação. Confira a nota original antes de concluir.</p>`;
    const RESPOSTA = `<p class="fi-resposta">Direito de resposta: o gabinete pode enviar explicação, que será publicada junto ao alerta.</p>`;
    const ESCOPO_TXT = ["indício desta nota", "padrão de um dia", "padrão do conjunto de notas", "sem nota ligada"];
    const nomeFornecedor = i => est.detalhe.f[i] ? est.detalhe.f[i][0] : "";
    const categoria = r => (est.categorias && est.categorias[r[2]]) || "";
    const copiar = texto => `<button type="button" class="botao secundario pequeno" data-acao="copiar" data-rotulo="${texto}">${texto}</button>`;
    // E8: compartilhar com texto neutro (app.js trata o clique; o endereço é o da ficha na hora do toque)
    const nomeDoPerfil = () => ($("#resumo h1") || {}).textContent || "";
    const compartilharBotao = texto => `<button type="button" class="botao secundario pequeno" data-compartilhar="${esc(texto)}" data-rotulo="Compartilhar">Compartilhar</button>`;
    const NEUTRO = "Indício não é acusação: é um padrão nos dados públicos que pede explicação.";
    const assistida = xs => xs.some(x => /assistida/.test(x.revisaoHtml))
      ? `<p class="fi-nota-rev">A revisão assistida é feita com agentes de IA, sem confirmação de uma pessoa.</p>` : "";
    const revisao = x => x.revisaoHtml ? `<div class="fi-rev ${esc(x.veredito)}">${x.revisaoHtml}</div>`
      : `<p class="fi-rev pendente">Ainda não revisado.</p>`;
    const comoFunciona = x => {
      const r = est.regras && est.regras[x.regra];
      return r && r.x ? `<details class="fi-regra"><summary>Como esta regra funciona</summary><p>${esc(r.x)}</p></details>` : "";
    };
    function aviso(t, texto, extra = "") {
      return { rotulo: "Painel", titulo: t, corpo: `<p>${esc(texto)}</p>${extra}` };
    }
    function faixaDeMeses(linhas) {
      if (!linhas.length) return "";
      const ms = linhas.map(i => est.detalhe.d[i][0]), m0 = Math.min(...ms), m1 = Math.max(...ms);
      return m0 === m1 ? `em ${nomeMes(meses[m0])}` : `de ${nomeMes(meses[m0])} a ${nomeMes(meses[m1])}`;
    }
    function historico(nota, ks) {
      const itens = linhaDoTempo(nota, ks.map(k => ({ titulo: est.M.dados[k].titulo, h: (est.detalhe.h || [])[k],
        revisado: !!est.M.dados[k].revisaoHtml })));
      return `<ol class="fi-historico">${itens.map(it => `<li${it.vazado ? ` class="vazado"` : ""}><span class="d">${esc(it.quando)}</span>`
        + `<span class="ev">${esc(it.rotulo)}</span><span class="fonte">${esc(it.fonte)}</span>`
        + (it.pedido != null && document.getElementById(`pedido-${it.pedido}`)
          ? `<button type="button" class="fi-link" data-acao="pedido" data-id="${esc(it.pedido)}">Ver o pedido</button>` : "")
        + `</li>`).join("")}</ol>`;
    }
    // os motivos por tipo (a própria nota, um dia, o conjunto, sem nota) e, em cada tipo, por gravidade
    const emOrdem = ks => [...ks].sort((p, q) => est.detalhe.a[p][1] - est.detalhe.a[q][1] || est.M.dados[q].g - est.M.dados[p].g || p - q);
    function motivo(k, naNota) {
      const x = est.M.dados[k], [chave, escopo, linhas] = est.detalhe.a[k];
      const obs = naNota && escopo !== ESCOPO_NOTA && linhas.length > 1
        ? `<p class="fi-obs">O indício está no conjunto de ${plural(linhas.length, "nota", "notas")} ${escopo === ESCOPO_DIA ? "do mesmo dia" : "deste alerta"}, não necessariamente nesta.</p>` : "";
      return `<article class="fi-motivo g${x.g}"><p class="fi-motivo-cab">${pill(x.g)}<span class="fi-escopo">${ESCOPO_TXT[escopo] || ""}</span></p>
        <h4>${esc(x.titulo)}</h4><p class="fi-desc">${esc(x.desc)}</p>${obs}${revisao(x)}${comoFunciona(x)}
        <button type="button" class="botao secundario pequeno" data-abre="alerta:${esc(chave)}">Histórico e notas deste alerta</button></article>`;
    }
    function itemNota(i) {
      const r = est.detalhe.d[i], ide = r[6];
      const conteudo = `<span class="it-txt"><b>${esc(r[1] || nomeMes(meses[r[0]]))}</b> · ${esc(nomeFornecedor(r[3]))}`
        + `${categoria(r) ? `<br><small>${esc(categoria(r))}</small>` : ""}</span><span class="it-v">${brl2(r[5])}</span>`;
      return ide ? `<li><a class="item sem-pill" href="${esc(hrefDe(`nota:${ide}`))}" data-abre="${esc(`nota:${ide}`)}">${conteudo}`
        + `<span class="seta" aria-hidden="true"></span></a></li>` : `<li><span class="item sem-pill">${conteudo}</span></li>`;
    }

    // ---- vistas
    function vistaNota(ide) {
      const D = est.detalhe, linhas = linhasDoDocumento(D.d, ide, est.citadas);
      if (!linhas.length) return aviso("Nota não encontrada neste perfil",
        "Nenhuma despesa deste gabinete, nos meses publicados, tem este código de documento.");
      const citadas = linhas.filter(i => est.citadas.has(i)), principais = citadas.length ? citadas : linhas;
      const r = D.d[principais[0]], forn = nomeFornecedor(r[3]);
      const ks = emOrdem(alertasDasLinhas(D.a, principais).filter(k => est.M.dados[k]));
      const total = principais.reduce((s, i) => s + D.d[i][5], 0), url = est.linkNota ? est.linkNota(r) : null;
      const lancamentos = principais.length > 1
        ? `<p class="fi-meta">Este documento tem ${plural(principais.length, "lançamento", "lançamentos")} com indício neste gabinete:</p>
          <ul class="fi-lanc">${principais.map(i => `<li>${esc(categoria(D.d[i]) || "Despesa")} · ${brl2(D.d[i][5])}</li>`).join("")}</ul>` : "";
      const outros = linhas.length - principais.length;
      // a glosa: por que o valor aqui é menor que o impresso na nota (só com um lançamento, para a conta ficar clara)
      const g = principais.length === 1 ? r[10] : null;
      const glosa = g ? `<p class="fi-meta">A nota é de ${brl2(g[0])}. A Câmara não reembolsou ${brl2(g[1])} (glosa) e pagou ${brl2(r[5])}.</p>` : "";
      const nota = { data: r[1], mes: meses[r[0]], fornecedor: forn };
      const corpoNota = `
        <p class="fi-meta">${[forn, categoria(r), `competência ${nomeMes(meses[r[0]])}`, r[4] ? `nº ${r[4]}` : ""].filter(Boolean).map(esc).join(" · ")}</p>
        ${glosa}${lancamentos}${outros ? `<p class="fi-meta">O mesmo documento tem mais ${plural(outros, "lançamento", "lançamentos")} sem indício.</p>` : ""}
        ${AVISO}
        ${url ? `<a class="botao fi-camara sai" href="${esc(url)}" target="_blank" rel="noopener">Ver a nota na Câmara<span class="vh"> (abre o site da Câmara)</span></a>`
          : `<p class="fi-meta">A Câmara não publicou o documento desta despesa.</p>`}
        <h3>Por que esta nota foi marcada (${ks.length})</h3>
        ${ks.length ? ks.slice(0, 3).map(k => motivo(k, true)).join("")
          + (ks.length > 3 ? `<details class="fi-mais"><summary>Mostrar mais ${plural(ks.length - 3, "motivo", "motivos")}</summary>${ks.slice(3).map(k => motivo(k, true)).join("")}</details>` : "")
          : `<p class="lt-vazio">Nenhum alerta ativo cita esta nota hoje.</p>`}
        ${assistida(ks.map(k => est.M.dados[k]))}
        <h3>Linha do tempo da nota</h3>${historico(nota, ks)}
        <div class="fi-acoes">${copiar("Copiar link desta nota")}${compartilharBotao(`Nota da cota parlamentar de ${nomeDoPerfil()} com indício apontado no De Olho na Cota. ${NEUTRO}`)}
          <button type="button" class="botao secundario pequeno" data-acao="ver-mes" data-mes="${r[0]}">Ver o mês no gráfico</button></div>
        ${RESPOSTA}`;
      return { rotulo: ks.some(k => D.a[k][1] === ESCOPO_NOTA) ? "Nota com indício" : ks.length ? "Nota citada em alerta" : "Nota",
        titulo: `Nota de ${r[1] || nomeMes(meses[r[0]])} · ${brl2(total)}`, corpo: corpoNota };
    }

    function vistaAlerta(chave) {
      const D = est.detalhe, ks = D.a.flatMap(([c], k) => c === chave && est.M.dados[k] ? [k] : []);
      if (!ks.length) {
        const pagina = /^[0-9a-f]{16}$/.test(chave)
          ? `<p><a class="botao secundario pequeno" href="${RAIZ}alerta/${chave}.html">Ver a página permanente do alerta</a></p>` : "";
        return aviso("Alerta fora deste perfil", "Este alerta não está entre os alertas ativos deste gabinete: pode ter sido "
          + "descartado na revisão, deixado de ser apontado ou ganhado outro código depois de uma atualização dos dados.", pagina);
      }
      const k = ks[0], x = est.M.dados[k], escopo = D.a[k][1];
      const linhas = [...new Set(ks.flatMap(j => D.a[j][2]))].sort((p, q) => p - q);
      // código repetido: o valor de um <article> é só o dele; soma as notas distintas de todos
      const valor = ks.length > 1 && linhas.length ? `${brlCurto(linhas.reduce((s, i) => s + D.d[i][5], 0))} envolvidos` : x.valor;
      const meta = [valor, linhas.length ? plural(linhas.length, "nota citada", "notas citadas") : "", faixaDeMeses(linhas)].filter(Boolean);
      const notas = !linhas.length
        ? `<p class="lt-vazio">${escopo === ESCOPO_SEM_NOTA ? "Este alerta não tem nota fiscal ligada: o indício está nos dados do gabinete."
          : "As notas deste alerta ficam fora dos meses publicados no perfil."}</p>`
        : `<ul class="itens fi-notas">${linhas.slice(0, P.limite).map(itemNota).join("")}</ul>`
          + (linhas.length > P.limite ? `<button type="button" class="botao secundario pequeno" data-acao="mais-notas">Mostrar mais `
            + `${plural(Math.min(50, linhas.length - P.limite), "nota", "notas")}${linhas.length - P.limite > 50 ? ` (faltam ${linhas.length - P.limite})` : ""}</button>` : "");
      const corpoAlerta = `
        <p class="fi-meta">${pill(x.g)} ${esc(meta.join(" · "))}</p>
        ${ks.length > 1 ? `<p class="fi-meta">Este código reúne ${ks.length} alertas iguais deste gabinete: mesma regra e mesma descrição, em notas diferentes.</p>` : ""}
        <p class="fi-aviso">Indício não é acusação: é um padrão nos dados que pede explicação. Valor envolvido não é prejuízo comprovado.</p>
        <p class="fi-desc">${esc(x.desc)}</p>${revisao(x)}${assistida([x])}${comoFunciona(x)}
        <h3>Histórico do alerta</h3>${historico(null, [k])}
        <h3>Notas citadas (${linhas.length})</h3>${notas}
        <div class="fi-acoes">${x.href ? `<a class="botao secundario pequeno" href="${esc(x.href)}">Página permanente do alerta</a>` : ""}${copiar("Copiar link deste alerta")}${compartilharBotao(`Alerta da cota parlamentar de ${nomeDoPerfil()} no De Olho na Cota: ${x.titulo}. ${NEUTRO}`)}</div>
        ${RESPOSTA}`;
      return { rotulo: `Alerta · ${ESCOPO_ROTULO[escopo] || ""}`, titulo: x.titulo, corpo: corpoAlerta };
    }

    function vistaFornecedor(valor) {
      const gr = est.M.grupos.find(g => chaveDoGrupo(g) === valor) || est.M.grupos.find(g => g.alertas.some(k => est.detalhe.a[k][0] === valor));
      if (!gr) return aviso("Fornecedor fora deste perfil", "Nenhum fornecedor com indício deste gabinete tem este código.");
      const ks = emOrdem(gr.alertas.filter(k => est.M.dados[k])), doc = chaveDoGrupo(gr);
      const meta = gr.linhas.length
        ? `${plural(gr.alertas.length, "alerta", "alertas")} · notas ${faixaDeMeses(gr.linhas)} · ${brlCurto(gr.total)} em ${plural(gr.linhas.length, "nota citada", "notas citadas")}`
        : plural(gr.alertas.length, "alerta", "alertas");
      const corpoForn = `
        <p class="fi-meta">${esc(meta)}</p>
        <p class="fi-aviso">O indício está no padrão da relação com o fornecedor, não necessariamente em cada nota. Valor envolvido não é prejuízo comprovado.</p>
        <h3>Alertas deste fornecedor (${ks.length})</h3>${ks.map(k => motivo(k, false)).join("")}${assistida(ks.map(k => est.M.dados[k]))}
        <div class="fi-acoes">${/^\d{14}$/.test(doc) ? `<button type="button" class="botao secundario pequeno" data-acao="despesas-forn" data-doc="${doc}">Ver as despesas com este fornecedor</button>` : ""}
          ${copiar("Copiar link deste fornecedor")}</div>
        ${RESPOSTA}`;
      return { rotulo: gr.forn < 0 ? "Alertas sem nota ligada" : "Fornecedor com indício",
        titulo: nomeForn(gr) + (gr.varias ? " e outras empresas" : ""), corpo: corpoForn };
    }

    function vistaMes(valor) {
      const i = meses.indexOf(+valor);
      if (i < 0) return aviso("Mês fora dos dados", `O perfil tem os meses de ${nomeMes(meses[0])} a ${nomeMes(meses[N - 1])}.`);
      if (est.sel !== i) mostrarMes(i);  // o gráfico da página acompanha
      const lista = est.M.comIndicio, antes = [...lista].reverse().find(m => m < i), depois = lista.find(m => m > i);
      const nav = (j, dir, rot) => `<button type="button" class="nav-mes" data-acao="mes-ir" data-dir="${dir}" data-valor="${j === undefined ? "" : meses[j]}"`
        + ` aria-label="${rot}"${j === undefined ? " disabled" : ""}>${dir === "antes" ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>'}</button>`;
      const corpoMes = `
        <div class="fi-nav-mes">${nav(antes, "antes", "Mês anterior com indício")}<p class="cartao-resumo">${esc(resumoDoMes(i))}</p>${nav(depois, "depois", "Próximo mês com indício")}</div>
        ${plenarioDoMes(i) ? `<p class="cartao-plenario">${esc(plenarioDoMes(i))}</p>` : ""}
        ${listasDoMes(i, "h3")}
        <div class="fi-acoes">${despesasNoMes[i] ? `<button type="button" class="botao secundario pequeno" data-acao="despesas-mes" data-mes="${meses[i]}">Ver as ${plural(despesasNoMes[i], "despesa", "despesas")} de ${nomeMes(meses[i])}</button>` : ""}
          ${copiar("Copiar link deste mês")}</div>`;
      return { rotulo: "Mês", titulo: maiuscula(nomeMesLongo(meses[i])), corpo: corpoMes };
    }

    // ---- eventos
    async function copiarTexto(b, texto) {
      try { await navigator.clipboard.writeText(texto); b.textContent = "Link copiado"; }
      catch { b.textContent = "Copie o endereço na barra do navegador"; }
      setTimeout(() => { if (b.isConnected) b.textContent = b.dataset.rotulo; }, 2500);
    }
    const enderecoCompleto = hash => location.origin + location.pathname + location.search + hash;

    document.addEventListener("click", e => {
      const link = e.target.closest("[data-copiar-link]");
      if (link) {
        const { tipo, valor } = separar(link.dataset.copiarLink);
        copiarTexto(link, enderecoCompleto(enderecoCom(location.hash, { [tipo]: valor })));
        return;
      }
      const el = e.target.closest("[data-abre]");
      if (!el || e.defaultPrevented) return;
      if (el.tagName === "A" && (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) return;  // nova aba: o link vale sozinho
      e.preventDefault();
      if (caixaP.contains(el)) empilhar(separar(el.dataset.abre), el); else abrir(separar(el.dataset.abre), el);
    });
    corpo.addEventListener("click", e => {
      const b = e.target.closest("[data-acao]");
      if (!b) return;
      const acao = b.dataset.acao;
      if (acao === "copiar") copiarTexto(b, location.href);
      else if (acao === "mais-notas") {
        const antes = P.limite;
        P.limite += 50;
        mostrar({ focarTitulo: false, manterRolagem: true });
        const novo = corpo.querySelectorAll(".fi-notas li")[antes];
        if (novo) (novo.querySelector("a") || novo).focus();
      } else if (acao === "ver-mes") {
        const i = +b.dataset.mes;
        fechar(() => {
          mostrarMes(i);
          $("#cartao-mes").scrollIntoView({ block: "center", behavior: SEM_MOVIMENTO ? "auto" : "smooth" });
          $("#cartao-titulo").focus({ preventScroll: true });
        });
      } else if (acao === "despesas-mes") {
        const m = b.dataset.mes;
        fechar(() => { if (opcoes.aoVerDespesas) opcoes.aoVerDespesas(m); });
      } else if (acao === "despesas-forn") {
        const doc = b.dataset.doc;
        fechar(() => { if (opcoes.aoVerFornecedor) opcoes.aoVerFornecedor(doc); });
      } else if (acao === "pedido") {
        const id = b.dataset.id;
        fechar(() => {
          const linha = document.getElementById(`pedido-${id}`);
          if (!linha) return;
          linha.tabIndex = -1;
          linha.scrollIntoView({ block: "center", behavior: SEM_MOVIMENTO ? "auto" : "smooth" });
          linha.focus({ preventScroll: true });
        });
      } else if (acao === "mes-ir" && b.dataset.valor) {
        const dir = b.dataset.dir;
        trocar({ tipo: "mes", valor: b.dataset.valor });
        const mesmo = corpo.querySelector(`[data-acao="mes-ir"][data-dir="${dir}"]`);
        (mesmo && !mesmo.disabled ? mesmo : titulo).focus();
        // o foco fica no botão, que tem sempre o mesmo nome: o leitor de tela ouve o mês novo por aqui
        const resumo = corpo.querySelector(".cartao-resumo");
        const linhaPl = corpo.querySelector(".cartao-plenario");
        anuncioP.textContent = `${titulo.textContent}. ${resumo ? resumo.textContent : ""}${linhaPl ? `. ${linhaPl.textContent}` : ""}`;
      }
    });
    voltar.addEventListener("click", () => history.back());
    caixaP.querySelector(".fi-fechar").addEventListener("click", () => fechar());
    // o véu (fora da caixa) fecha; o cabeçalho e o corpo cobrem a caixa inteira. Só quando o toque também começou no
    // véu: uma seleção de texto que sai da caixa termina num clique no próprio <dialog>
    let comecouNoVeu = false;
    caixaP.addEventListener("pointerdown", e => { comecouNoVeu = e.target === caixaP; });
    caixaP.addEventListener("click", e => { if (comecouNoVeu && e.target === caixaP) fechar(); comecouNoVeu = false; });
    // no Android, o Voltar do sistema chega como pedido de fechamento do <dialog> (não passa pelo histórico): com mais
    // de uma vista, volta uma, como nos outros aparelhos. O Esc fecha tudo
    let porEsc = false;
    caixaP.addEventListener("keydown", e => { porEsc = e.key === "Escape"; });
    caixaP.addEventListener("cancel", e => {
      if (!porEsc && profundidade() > 1 && e.cancelable) { e.preventDefault(); history.back(); }
      porEsc = false;
    });
    // o Esc e o gesto de voltar do Android fecham o <dialog> sem passar pelo histórico: tira as entradas do painel.
    // Fechado por concluir(), o histórico já voltou (profundidade 0); reaberto antes deste evento, fica aberto
    caixaP.addEventListener("close", () => { if (!caixaP.open && profundidade() > 0) fechar(); });
    addEventListener("popstate", () => {
      const n = profundidade(), vista = vistaDoEndereco(location.hash);
      if (n > 0 && vista) {
        // voltou (ou avançou) dentro do painel: o foco vai ao item que tinha aberto a vista de cima
        const saiu = P.pilha.length > n ? P.pilha[n] : null;
        P.pilha.length = Math.min(P.pilha.length, n);
        while (P.pilha.length < n) P.pilha.push(null);
        P.limite = (saiu && saiu.limite) || 20;
        mostrar({ focarEm: saiu ? saiu.abre : "", como: saiu });
      } else if (vista) linkDireto();  // endereço trocado à mão, ou um link #nota= seguido sem o perfil.js interceptar
      else concluir();
    });

    return { abrir, linkDireto };
  }

  const painel = temPainel() ? criarPainel() : null;

  recorte.innerHTML = JANELAS.map(j => `<button type="button" data-janela="${j.id}" aria-pressed="${j === est.janela}">${j.rotulo}</button>`).join("");
  recorte.addEventListener("click", e => {
    const b = e.target.closest("button[data-janela]");
    if (b) mudarJanela(JANELAS.find(j => j.id === b.dataset.janela));
  });
  faixa.addEventListener("input", () => escolher(+faixa.value));
  // o ponto da pilha do mês sob o clique (no trilho), ou null: num mês de um ponto só, qualquer clique no trilho vale;
  // com vários, o da altura clicada (o "+" do mês com mais de POR_MES não abre nenhum: a lista do cartão tem todos)
  function pontoNoClique(r) {
    const G = caixa._G, l = pontosDe(r.i);
    if (!G || !l.length || r.py < G.lT - 4) return null;
    if (l.length === 1) return l[0];
    const k = Math.round((G.lT + G.lH - 3 - G.r - r.py) / G.passoP);
    if (k < 0 || k >= Math.min(l.length, POR_MES) || (k === POR_MES - 1 && l.length > POR_MES)) return null;
    return l[k];
  }
  // escolher de novo o mês já escolhido não muda nada na tela: o clique leva à lista das notas do mês, com um realce
  function mostrarListaDoMes() {
    const ul = cartao.querySelector(".itens");
    if (!ul) return;
    ul.scrollIntoView({ block: "nearest", behavior: SEM_MOVIMENTO ? "auto" : "smooth" });
    ul.classList.remove("realce");
    void ul.offsetWidth;  // reinicia a animação num segundo clique
    ul.classList.add("realce");
  }
  caixa.addEventListener("click", e => {
    const r = mesNoPonto(e);
    if (!r) return;
    // no computador, um clique num ponto do trilho abre o painel direto; no toque (pontos pequenos), escolhe o mês e
    // leva à lista dele, de itens grandes
    const p = painel && FINO.matches ? pontoNoClique(r) : null;
    if (p) {
      escolher(r.i);
      const abre = abreDoPonto(p), [tipo, valor] = [abre.slice(0, abre.indexOf(":")), abre.slice(abre.indexOf(":") + 1)];
      painel.abrir({ tipo, valor }, faixa);
      return;
    }
    escolher(r.i, true);
    if (pontosDe(r.i).length) mostrarListaDoMes();
  });
  caixa.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    const r = mesNoPonto(e);
    if (!r) return;
    const n = pontosDe(r.i).length;
    dica.innerHTML = `<strong>${maiuscula(nomeMesLongo(meses[r.i]))}</strong>${brl(dados.valores[r.i])}`
      + (n ? `<br><small>${plural(n, "indício próprio", "indícios próprios")}</small>` : "") + `<br><small>clique para ver o mês</small>`;
    dica.hidden = false;
    const { esq } = interno();
    dica.style.left = `${limitar(esq + caixa._G.x(r.i) * r.escala, 80, caixa.clientWidth - 80)}px`;
    dica.style.top = `${8}px`;
  });
  caixa.addEventListener("pointerleave", () => { dica.hidden = true; });
  // tocar no Plenário escolhe o mês, como no gráfico de gastos (o mesmo eixo)
  if (plen) plen.addEventListener("click", e => {
    const G = caixa._G, svg = plen.querySelector("svg");
    if (!G || !svg) return;
    const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / (r.width / G.W);
    escolher(limitar(Math.floor((px - G.m.e) / G.passo) + G.i0, G.i0, G.i1), true);
  });
  cartao.addEventListener("click", e => {
    const nav = e.target.closest(".nav-mes");
    if (nav && nav.dataset.ir !== "") {
      const dir = nav.getAttribute("aria-label").startsWith("Próximo") ? "Próximo" : "Mês anterior";
      escolher(+nav.dataset.ir, true);
      const mesmo = cartao.querySelector(`.nav-mes[aria-label^="${dir}"]`);
      (mesmo && !mesmo.disabled ? mesmo : $("#cartao-titulo")).focus?.();
      return;
    }
    const grupo = e.target.closest("[data-grupo]");
    if (grupo) {
      const k = +grupo.dataset.grupo;
      if (k >= 5 && !est.todosForn) { est.todosForn = true; desenharFornecedores(); }
      const det = $(`#forn-${k}`);
      if (det) { det.open = true; det.querySelector("summary").focus(); det.scrollIntoView({ block: "nearest", behavior: SEM_MOVIMENTO ? "auto" : "smooth" }); }
      return;
    }
    if (e.target.closest(".ver-despesas") && opcoes.aoVerDespesas) opcoes.aoVerDespesas(String(meses[est.sel]));
  });
  $("#forn-mais").addEventListener("click", () => { est.todosForn = !est.todosForn; desenharFornecedores(); });
  if (window.ResizeObserver) new ResizeObserver(() => { if (Math.abs(caixa.clientWidth - (caixa._largura || 0)) > 8) desenhar(); }).observe(caixa);

  est.sel = mesInicial(meses, [], opcoes.periodo);
  const anoInicial = JANELAS.find(j => j.id && String(opcoes.periodo || "").length === 4 && j.id === String(opcoes.periodo));
  if (anoInicial) mudarJanela(anoInicial); else desenharTudo();

  return {
    // com o arquivo do deputado (dados/dep/<id>.json): pontos, fornecedores e tabela; depois, o painel do endereço
    // (#nota=, #alerta=...). extras, do app.js: categorias (resumo.json) e linkNota (o link da nota na Câmara)
    detalhe(detalhe, extras = {}) {
      est.detalhe = detalhe;
      est.categorias = extras.categorias || null;
      est.linkNota = extras.linkNota || null;
      est.edicao = extras.edicao || null;
      // a presença mês a mês (E5): sem 'pr' (sem presença no banco) ou sem as sessões, o Plenário fica escondido
      est.presencaAte = extras.presencaAte || null;
      est.plen = detalhe.pr && extras.sessoes
        ? presencaPorMes(detalhe.pr, datasDasSessoes(extras.sessoes), meses, extras.edicao || est.presencaAte) : null;
      if (est.plen && !est.plen.some(Boolean)) est.plen = null;
      if (plen && est.plen) [plen, $("#pl-legenda")].forEach(el => { if (el) el.hidden = false; });
      est.citadas = new Set((detalhe.a || []).flatMap(x => x[2]));
      detalhe.d.forEach(r => { if (r[0] < N) despesasNoMes[r[0]]++; });
      est.M = montar(detalhe.a || [], detalhe.d, lerAlertasDaPagina(), N);
      const p = String(opcoes.periodo || "");
      if (!est.tocado) est.sel = mesInicial(meses, est.M.pontos, p.length === 6 ? p : est.janela.id);
      desenharTudo();
      desenharTabela();
      marcarNovidades();
      // os arquivos para baixar: o CSV só quando há alerta no perfil
      if (baixar) {
        const temAlerta = est.M.dados.some(Boolean);
        baixar.hidden = false;
        $("#lt-csv").hidden = !temAlerta;
        if (!temAlerta) $("#lt-baixar-texto").textContent = "Para reportagem ou pesquisa: o gráfico sai no período escolhido acima, com fonte e data.";
      }
      if (!painel) return;
      const vista = vistaDoEndereco(location.hash);
      // o link direto escolhe na página o mês da nota (o foco volta ao item dela quando o painel fecha)
      if (vista && vista.tipo === "nota") {
        const i = linhasDoDocumento(detalhe.d, vista.valor, est.citadas)[0];
        if (i !== undefined) mostrarMes(detalhe.d[i][0]);
      }
      carregarRegras().then(() => painel.linkDireto());
    },
    // o período escolhido em outro lugar da página (tabela de despesas): mostra o mês ou o ano
    periodo(valor) {
      const p = String(valor || "");
      if (p.length === 6 && meses.includes(+p)) {
        const i = meses.indexOf(+p);
        if (i < est.janela.i0 || i > est.janela.i1) { est.sel = i; mudarJanela(JANELAS[0]); } else escolher(i);
      } else if (p.length === 4) {
        const j = JANELAS.find(x => x.id === p);
        if (j && j !== est.janela) mudarJanela(j, false);
      } else if (!p && est.janela.id) {
        mudarJanela(JANELAS[0]);
      }
    },
  };
}

exportar({ montar, mesDaMaioria, janelas, mesInicial, iniciar, datasDasSessoes, presencaPorMes, VISTAS, BASE_HISTORICO, enderecoCom, vistaDoEndereco,
  linhasDoPacote, CABECALHO_PACOTE, svgParaMateria, CORES_SVG, ATRIBUTOS_SVG, novidadesDesde, retratoDosAlertas, proximaVisita,
  diaISO, dataDoDia, linhasDoDocumento, alertasDasLinhas, eventosDoAlerta, textoEvento, linhaDoTempo });
})(typeof module !== "undefined" ? x => { module.exports = x; } : x => { window.LinhaDoTempo = x; });
