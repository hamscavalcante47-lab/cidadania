"use strict";
// Autoteste no navegador (E8): na revisão manual do site publicado, confere numa amostra de deputados se a página e o
// arquivo de dados dele estão de acordo, como a auditoria do gerador (conferir_perfis) faz no site inteiro, com o que
// se pode conferir sem o banco: as chaves e a ordem dos alertas ('a') contra os <article> da página, os índices das
// notas em 'd' e o código do documento, o histórico ('h') bem formado, a presença diária ('pr') contra resumo.json e
// presenca.json (tamanho, códigos, faltas), os gastos mês a mês contra o gráfico da página e as páginas permanentes de
// alguns alertas. Só lê: baixa os arquivos do próprio site. Carregado só em autoteste.html, antes do app.js; a parte
// sem página (conferirPerfil) é testada no Node (testes/autoteste.test.js). Com os alertas fora do site
// (data-alertas="0" no <body>), confere só presença e gastos.
(function (exportar) {

// os códigos de 'pr' (CODIGOS em cidadania/site/presenca.py) e o tamanho de cada evento de 'h' (TAMANHO_DO_EVENTO na
// auditoria)
const CODIGOS_PRESENCA = "PpFMSDOJ-";
const TAMANHO_DO_EVENTO = { 1: 2, 2: 2, 3: 4, 4: 3, 5: 5, 6: 5, 7: 3, 8: 3 };
const inteiro = v => Number.isInteger(v);
const historicoValido = item => Array.isArray(item) && item.length > 0 && inteiro(item[0]) && item.slice(1).every(ev =>
  Array.isArray(ev) && ev.length && inteiro(ev[0]) && TAMANHO_DO_EVENTO[ev[0]] === ev.length && ev.slice(1).every(v => v === null || inteiro(v)));

// as conferências de um perfil, sem rede: [nome, problemas[]] para cada uma. chaves: os data-chave dos <article> da
// página, na ordem; dep: dados/dep/<id>.json; sessoes: resumo.json "sessoes"; presenca: as linhas do deputado em
// presenca.json ([mês, dias com sessão, presente, faltas], ou undefined); grafico: o JSON embutido na página (meses e
// valores), ou null; alertas: false quando os alertas estão fora do site (data-alertas="0"), e aí as conferências de
// alerta ('a', 'h', ordem dos <article>) não são feitas
function conferirPerfil({ chaves, dep, sessoes, presenca, grafico, alertas = true }) {
  const a = dep.a || [], d = dep.d || [], h = dep.h || [], r = [];
  if (alertas) {
    const ordem = [];
    if (a.length !== chaves.length) ordem.push(`${a.length} alertas nos dados e ${chaves.length} na página`);
    a.forEach((x, k) => { if (k < chaves.length && chaves[k] !== x[0]) ordem.push(`posição ${k + 1}: ${x[0]} nos dados, ${chaves[k]} na página`); });
    r.push(["Alertas na mesma ordem da página", ordem]);
    const notas = [];
    a.forEach(([chave, escopo, idx]) => {
      if (![0, 1, 2, 3].includes(escopo)) notas.push(`${chave}: escopo ${escopo}`);
      if (!Array.isArray(idx) || idx.some((i, j) => !inteiro(i) || i < 0 || i >= d.length || (j && i <= idx[j - 1]))) notas.push(`${chave}: índices fora de 'd' ou fora de ordem`);
      else if (idx.some(i => d[i][6] == null || d[i][6] === "")) notas.push(`${chave}: nota citada sem o código do documento`);
    });
    r.push(["Notas de cada alerta", notas]);
    const hist = [];
    if (h.length !== a.length) hist.push(`${h.length} históricos para ${a.length} alertas`);
    h.forEach((x, k) => { if (x !== null && !historicoValido(x)) hist.push(`posição ${k + 1}: histórico mal formado`); });
    r.push(["Histórico de cada alerta", hist]);
  }
  const pres = [];
  const faltas = presenca ? presenca.reduce((s, x) => s + x[3], 0) : 0;
  if (dep.pr == null) {
    if (presenca && presenca.length) pres.push("o deputado tem presença no ranking e o arquivo não traz a presença diária");
  } else {
    if (dep.pr.length !== (sessoes || []).length) pres.push(`${dep.pr.length} dias na presença e ${(sessoes || []).length} sessões no resumo`);
    if ([...dep.pr].some(c => !CODIGOS_PRESENCA.includes(c))) pres.push("código de presença desconhecido");
    const f = [...dep.pr].filter(c => c === "F").length;
    if (f !== faltas) pres.push(`${f} faltas sem justificativa na presença diária e ${faltas} no ranking`);
  }
  r.push(["Presença dia a dia", pres]);
  const gastos = [];
  if (grafico) {
    const soma = grafico.meses.map(() => 0);
    d.forEach(x => { if (x[0] < soma.length) soma[x[0]] += x[5]; });
    grafico.valores.forEach((v, i) => { if (Math.abs(Math.round(soma[i]) - v) > 1) gastos.push(`${grafico.meses[i]}: ${v} no gráfico, ${Math.round(soma[i])} nas despesas`); });
  } else gastos.push("a página não tem os dados do gráfico");
  r.push(["Gastos mês a mês iguais ao gráfico", gastos]);
  return r;
}

// os códigos digitados: inteiros positivos, sem repetir; null quando algo não é código
function lerCodigos(texto) {
  const partes = String(texto || "").split(/[\s,;]+/).filter(Boolean);
  if (partes.some(p => !/^\d+$/.test(p) || +p <= 0)) return null;
  return [...new Set(partes.map(Number))];
}

function iniciar() {
  const caixa = document.querySelector("#autoteste");
  if (!caixa) return;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const raiz = document.body.dataset.raiz || "";
  // com os alertas fora do site, não há <article> de alerta, páginas alerta/ nem regras.json: nada disso é conferido
  const alertas = document.body.dataset.alertas !== "0";
  const baixar = async (caminho, como = "json") => {
    const r = await fetch(raiz + caminho, { cache: "no-store" });
    if (!r.ok) throw new Error(`${caminho}: HTTP ${r.status}`);
    return como === "json" ? r.json() : r.text();
  };
  const existe = async caminho => (await fetch(raiz + caminho, { method: "HEAD", cache: "no-store" })).ok;
  const n = (k, um, varios) => `${k} ${k === 1 ? um : varios}`;

  async function conferir(id, resumo, presenca) {
    const [html, dep] = await Promise.all([baixar(`deputado/${id}.html`, "texto"), baixar(`dados/dep/${id}.json`)]);
    const pagina = new DOMParser().parseFromString(html, "text/html");
    const artigos = alertas ? [...pagina.querySelectorAll("#lista-alertas-deputado article.alerta")] : [];
    const inline = pagina.querySelector("#dados-deputado");
    const r = conferirPerfil({ chaves: artigos.map(x => x.dataset.chave), dep, sessoes: resumo.sessoes, presenca: presenca[id],
      grafico: inline ? JSON.parse(inline.textContent) : null, alertas });
    if (alertas) {
      const paginas = [];
      for (const art of artigos.slice(0, 5)) {
        if (!(await existe(`alerta/${art.dataset.chave}.html`))) paginas.push(`alerta/${art.dataset.chave}.html não existe`);
      }
      r.push(["Páginas permanentes (até 5 alertas)", paginas]);
    }
    return { nome: (pagina.querySelector("#resumo h1") || {}).textContent || `deputado ${id}`, r };
  }

  const form = caixa.querySelector("form"), botao = form.querySelector("button");
  const saida = caixa.querySelector("#at-saida"), progresso = caixa.querySelector("#at-progresso"), estado = caixa.querySelector("#at-estado");
  let rodando = false;
  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    if (rodando) return;  // o botão não é desabilitado: o foco fica nele
    const digitados = lerCodigos(form.ids.value);
    if (digitados === null) { estado.textContent = "Os códigos têm de ser números, separados por vírgula ou espaço."; return; }
    rodando = true;
    botao.setAttribute("aria-disabled", "true");
    saida.innerHTML = ""; estado.textContent = "";
    try {
      const [deputados, resumo, presenca] = await Promise.all([baixar("dados/deputados.json"), baixar("dados/resumo.json"),
        baixar("dados/presenca.json").catch(() => ({}))]);
      let ids = digitados;
      if (!ids.length) {  // sorteio: o endereço com ?ids= repete a mesma amostra
        const todos = deputados.map(x => x.id), quantos = Math.min(Math.max(1, +form.n.value || 12), todos.length);
        if (!todos.length) throw new Error("dados/deputados.json está vazio");
        ids = [];
        while (ids.length < quantos) { const id = todos[Math.floor(Math.random() * todos.length)]; if (!ids.includes(id)) ids.push(id); }
      }
      history.replaceState(null, "", `?ids=${ids.join(",")}`);
      let problemas = 0, feitas = 0;
      for (const [k, id] of ids.entries()) {
        progresso.textContent = `Conferindo ${k + 1} de ${ids.length}…`;
        let linha;
        try {
          const { nome, r } = await conferir(id, resumo, presenca);
          feitas += r.length;
          problemas += r.reduce((s, [, p]) => s + p.length, 0);
          linha = `<h3><a href="deputado/${id}.html">${esc(nome)}</a> <span class="cat">(${id})</span></h3><ul>`
            + r.map(([nomeC, p]) => `<li class="${p.length ? "at-falha" : "at-ok"}">${p.length ? "✗" : "✓"} ${esc(nomeC)}`
              + (p.length ? `<ul>${p.slice(0, 10).map(x => `<li>${esc(x)}</li>`).join("")}${p.length > 10 ? `<li>e mais ${p.length - 10}</li>` : ""}</ul>` : "") + `</li>`).join("") + `</ul>`;
        } catch (erro) {
          problemas++;
          linha = `<h3>Deputado ${id}</h3><p class="at-falha">✗ Não deu para conferir: ${esc(erro.message)}</p>`;
        }
        saida.insertAdjacentHTML("beforeend", `<section class="cartao at-deputado">${linha}</section>`);
      }
      progresso.textContent = "";
      estado.textContent = `${n(ids.length, "deputado", "deputados")}, ${n(feitas, "conferência", "conferências")}: ${problemas ? n(problemas, "problema", "problemas") : "nenhum problema"}.`;
    } catch (erro) {
      progresso.textContent = "";
      estado.textContent = `Não deu para começar: ${erro.message}`;
    } finally { rodando = false; botao.removeAttribute("aria-disabled"); }
  });
  // ?ids= no endereço: preenche e roda
  const ids = new URLSearchParams(location.search).get("ids");
  if (ids) { form.ids.value = ids; form.requestSubmit(); }
}

if (typeof document !== "undefined") iniciar();
exportar({ conferirPerfil, lerCodigos, CODIGOS_PRESENCA, TAMANHO_DO_EVENTO });
})(typeof module !== "undefined" ? x => { module.exports = x; } : () => {});
