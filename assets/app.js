"use strict";

const NOMES_UF = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul",
  MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
  SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};
// o artigo de cada estado ("a Paraíba", "o Acre", "Minas Gerais"), para a frase sair certa
const ARTIGO_UF = { AC: "o", AP: "o", AM: "o", BA: "a", CE: "o", DF: "o", ES: "o", MA: "o", PA: "o", PB: "a", PR: "o",
  PI: "o", RJ: "o", RN: "o", RS: "o", TO: "o" };
const comArtigo = uf => ARTIGO_UF[uf] ? `${ARTIGO_UF[uf]} ${NOMES_UF[uf]}` : NOMES_UF[uf];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const RAIZ = document.body.dataset.raiz || "";
const VERSAO = document.body.dataset.versao || "";
// a chave dos alertas (PUBLICAR_ALERTAS, no gerador): com data-alertas="0" no <body>, o site sai sem nada de alerta, e
// os arquivos de alerta (alertas-meta.json, alertas-N.json, regras.json) nem existem. Sem o atributo, ligados
const ALERTAS = document.body.dataset.alertas !== "0";
// a página da empresa: a fixa (fornecedor/<CNPJ>.html) para quem tem; para os outros CNPJs, a página única
// (empresa.html#cnpj=), quando o site foi gerado com os dados de todas (data-empresas no body). CPF nunca tem página
const EMPRESAS = document.body.dataset.empresas === "1";
// só CNPJ de verdade (dígitos verificadores certos): zeros declarados no lugar do documento de uma pessoa não têm página
const cnpjValido = c => {
  if (!/^\d{14}$/.test(c) || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (base, pesos) => { const r = [...base].reduce((s, n, i) => s + n * pesos[i], 0) % 11; return r < 2 ? 0 : 11 - r; };
  const pesos = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = dv(c.slice(0, 12), pesos);
  return c.slice(12) === `${d1}${dv(c.slice(0, 12) + d1, [6, ...pesos])}`;
};
const enderecoEmpresa = (digitos, fixa) => fixa ? `${RAIZ}fornecedor/${digitos}.html`
  : EMPRESAS && cnpjValido(digitos) ? `${RAIZ}empresa.html#cnpj=${digitos}` : null;
const linkEmpresa = (digitos, fixa) => { const u = enderecoEmpresa(digitos, fixa); return u ? `<a href="${u}">página do fornecedor</a> · ` : ""; };
// a chave da equipe dos gabinetes (PUBLICAR_EQUIPE, no gerador): com data-equipe="0", o perfil sai sem a tabela da
// equipe e sem a chave 'e' nos dados, e a busca não tem funcionários (sem alertas, o índice de pessoas nem existe)
const EQUIPE = document.body.dataset.equipe !== "0";
// a chave da presença em Plenário (PUBLICAR_PRESENCA, no gerador): com data-presenca="0", o ranking sai sem as ordens de
// faltas, Comparar sem as linhas de presença, e os arquivos de presença (presenca.json, 'pr' e as sessões) nem existem
const PRESENCA = document.body.dataset.presenca !== "0";
const SEM_MOVIMENTO = matchMedia("(prefers-reduced-motion: reduce)").matches;
// modo econômico (E8): o navegador pediu economia de dados (navigator.connection.saveData, que hoje Opera, Samsung
// Internet e Yandex informam; Safari, Firefox e o Chrome não). A marca vem do <head> (pagina(), no gerador), antes de o
// CSS pedir as aquarelas, que somem; aqui, a comparação com todos os deputados vira um botão
const ECONOMIA = document.documentElement.classList.contains("economia");

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const brl = v => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = v => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// embaixo do valor reembolsado: o valor da nota e a parte que a Câmara não pagou (glosa), como glosa_html no site
const glosaHTML = (doc, glosa) => glosa > 0 ? `<span class="glosa">nota ${brl2(doc)}<br>glosa −${brl2(glosa)}</span>` : "";
const brlCurto = v => Math.abs(v) >= 1e6 ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`
  : Math.abs(v) >= 1e3 ? `R$ ${Math.round(v / 1e3).toLocaleString("pt-BR")} mil` : brl(v);
const normalizar = s => (s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const nomeMes = aaaamm => `${MESES[aaaamm % 100 - 1]}/${String(Math.floor(aaaamm / 100)).slice(2)}`;
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro",
  "outubro", "novembro", "dezembro"];
const nomeMesLongo = aaaamm => `${MESES_LONGOS[aaaamm % 100 - 1]} de ${Math.floor(aaaamm / 100)}`;
const pct = v => `${Math.round(v * 100)}%`;
const SEM_FOTO = `onerror="this.style.visibility='hidden'"`;
// quem não é titular eleito (deputados.json, campo "c"): há mais deputados com despesas que as 513 cadeiras
const CONDICAO = { s: "suplente", e: "suplente efetivado", a: "sem mandato nesta legislatura" };
const condicao = d => d.c ? ` · <span class="condicao">${CONDICAO[d.c]}</span>` : "";

// ------------------------------------------------------------------ período (toda a legislatura, um ano ou um mês)
// O valor é "" (tudo), "2025" (ano) ou "202503" (mês); `meses` é a lista AAAAMM publicada em resumo.json.
function opcoesPeriodo(select, meses, padrao = "") {
  const anos = [...new Set(meses.map(m => Math.floor(m / 100)))];
  select.innerHTML = `<option value="">Toda a legislatura</option>
    <optgroup label="Ano">${anos.map(a => `<option value="${a}">${a}</option>`).join("")}</optgroup>
    <optgroup label="Mês">${[...meses].reverse().map(m => `<option value="${m}">${nomeMesLongo(m)}</option>`).join("")}</optgroup>`;
  select.value = padrao;
  dividirPeriodo(select, meses);
}
// Ano e mês em duas caixas (45 opções numa caixa só não cabem no celular). A caixa original fica escondida e continua
// sendo a fonte da verdade: quem lê ou muda select.value, ou ouve o "change" dela, não precisa saber das duas.
function dividirPeriodo(select, meses) {
  if (select.dataset.dividido) return;
  select.dataset.dividido = "1";
  const anos = [...new Set(meses.map(m => Math.floor(m / 100)))];
  const ano = Object.assign(document.createElement("select"), { id: `${select.id}-ano` });
  ano.innerHTML = `<option value="">Toda a legislatura</option>${anos.map(a => `<option value="${a}">${a}</option>`).join("")}`;
  const mes = Object.assign(document.createElement("select"), { id: `${select.id}-mes` });
  mes.setAttribute("aria-label", "Mês");
  const caixa = Object.assign(document.createElement("span"), { className: "periodo-duplo" });
  caixa.append(ano, mes);
  select.after(caixa);
  select.hidden = true;
  const rotulo = document.querySelector(`label[for="${select.id}"]`);
  if (rotulo) rotulo.htmlFor = ano.id;
  else ano.setAttribute("aria-label", "Período");
  const original = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  const sincronizar = () => {
    const v = original.get.call(select);
    const a = v ? v.slice(0, 4) : "";
    ano.value = a;
    mes.innerHTML = `<option value="">${a ? "O ano todo" : "Escolha um ano"}</option>` + meses.filter(m => String(m).startsWith(a) && a)
      .map(m => `<option value="${m}">${MESES_LONGOS[m % 100 - 1]}</option>`).join("");
    mes.value = v.length === 6 ? v : "";
    mes.disabled = !a;
  };
  Object.defineProperty(select, "value", { configurable: true, get() { return original.get.call(this); },
    set(v) { original.set.call(this, v); sincronizar(); } });
  const escolher = v => { select.value = v; select.dispatchEvent(new Event("change", { bubbles: true })); };
  ano.addEventListener("change", () => escolher(ano.value));
  mes.addEventListener("change", () => escolher(mes.value || ano.value));
  sincronizar();
}
function indicesPeriodo(meses, valor) {
  if (!valor) return meses.map((_, i) => i);
  const v = +valor;
  return meses.flatMap((m, i) => (v < 10000 ? Math.floor(m / 100) === v : m === v) ? [i] : []);
}
const nomePeriodo = valor => !valor ? "toda a legislatura" : +valor < 10000 ? `${valor}` : nomeMesLongo(+valor);
const somar = (arr, idx) => idx.reduce((s, i) => s + (arr[i] || 0), 0);
// limite da cota nos meses do período em que o deputado teve despesa (exercício do mandato)
const limiteAtivo = (d, idx, limites) => idx.reduce((s, i) => s + (d.m[i] ? limites[d.uf][i] : 0), 0);
// d.a: [mês, gravidade] dos alertas médios e altos e [mês, gravidade, 1] de todo alerta confirmado (também os baixos).
// Com os alertas desligados, deputados.json vem sem "a": tudo zero
function contarAlertas(d, idx, todos) {
  const conjunto = new Set(idx);
  const lista = !ALERTAS || !d.a ? [] : todos ? d.a : d.a.filter(([m]) => m !== null && conjunto.has(m));
  return { g3: lista.filter(a => a[1] === 3).length, g2: lista.filter(a => a[1] === 2).length,
    k: lista.filter(a => a[2] === 1).length };
}
const json = async caminho => (await fetch(`${RAIZ}${caminho}?v=${VERSAO}`)).json();
// planilha com ";" e vírgula decimal, que o Excel em português abre direto; o BOM garante os acentos
function baixarCSV(nome, cabecalho, linhas) {
  // texto que começa com = + - @ (ou tabulação e CR, que o Excel pula) seria lido como fórmula: ganha um apóstrofo,
  // como no _csv dos relatórios
  const celula = v => typeof v === "number" ? String(v).replace(".", ",")
    : `"${String(v ?? "").replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`;
  const texto = [cabecalho, ...linhas].map(l => l.map(celula).join(";")).join("\r\n");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob(["\ufeff" + texto], { type: "text/csv;charset=utf-8" })), download: nome,
  });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const arquivo = s => normalizar(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ------------------------------------------------------------------ tabelas ordenáveis (todas as páginas)
// Valor de ordenação de uma célula: data-v quando houver; senão data dd/mm/aaaa, número/valor em reais ou texto.
// Vazio ("—") fica sempre no fim.
function valorOrdenacao(celula) {
  const bruto = celula.dataset.v ?? celula.textContent.trim();
  if (bruto === "" || bruto === "—") return null;
  if (celula.dataset.v !== undefined && bruto !== "" && !isNaN(bruto)) return +bruto;
  const data = bruto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (data && /^(desde )?\d{2}\/\d{2}\/\d{4}/.test(bruto)) return +`${data[3]}${data[2]}${data[1]}`;
  const numero = bruto.match(/^-?(R\$\s*)?([\d.]+(,\d+)?)\s*%?$/);
  if (numero) return (bruto.startsWith("-") ? -1 : 1) * numero[2].replace(/\./g, "").replace(",", ".");
  return normalizar(bruto);
}
// números primeiro, depois textos; vazios no fim em qualquer direção
function comparar(a, b, direcao) {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  const sinal = direcao === "ascending" ? 1 : -1;
  if (typeof a !== typeof b) return typeof a === "number" ? -1 : 1;
  return sinal * (typeof a === "number" ? a - b : a.localeCompare(b, "pt-BR", { numeric: true }));
}
// Transforma os cabeçalhos em botões. Sem `aoOrdenar`, ordena as linhas que já estão na página; com ele, quem
// desenha a tabela ordena os dados (tabelas paginadas, em que só parte das linhas está na página).
// Pode ser chamada de novo depois que a tabela for redesenhada: reaplica a ordem escolhida.
function tabelaOrdenavel(tabela, aoOrdenar) {
  if (!tabela) return;
  const cabecalho = [...tabela.rows].find(r => r.cells.length && [...r.cells].every(c => c.tagName === "TH"));
  if (!cabecalho) return;
  [...cabecalho.cells].forEach((th, i) => {
    if (th.classList.contains("sem-ordem") || th.querySelector(".ordenar")) return;
    th.innerHTML = `<button type="button" class="ordenar" data-coluna="${th.dataset.chave ?? i}">${th.innerHTML}</button>`;
  });
  const [coluna, direcao] = (tabela.dataset.ordem || "").split(":");
  [...cabecalho.cells].forEach((th, i) => {
    const b = th.querySelector(".ordenar");
    if (b && b.dataset.coluna === coluna) th.setAttribute("aria-sort", direcao); else th.removeAttribute("aria-sort");
  });
  if (!aoOrdenar && coluna !== undefined && coluna !== "") {
    const i = +coluna, linhas = [...tabela.rows].filter(r => r !== cabecalho && r.cells[i]);
    linhas.sort((x, y) => comparar(valorOrdenacao(x.cells[i]), valorOrdenacao(y.cells[i]), direcao))
      .forEach(r => r.parentNode.append(r));
  }
  if (tabela.dataset.pronta) return;
  tabela.dataset.pronta = "1";
  tabela.addEventListener("click", e => {
    const b = e.target.closest(".ordenar"); if (!b) return;
    const [atual, dir] = (tabela.dataset.ordem || "").split(":");
    let nova;
    if (atual === b.dataset.coluna) nova = dir === "ascending" ? "descending" : "ascending";
    else {
      // textos começam de A a Z; números e datas, do maior para o menor
      const i = [...b.closest("tr").cells].indexOf(b.closest("th"));
      const amostra = [...tabela.rows].map(r => r.cells[i]).filter(c => c && c.tagName === "TD").map(valorOrdenacao).find(v => v !== null);
      nova = typeof amostra === "string" ? "ascending" : "descending";
    }
    tabela.dataset.ordem = `${b.dataset.coluna}:${nova}`;
    aoOrdenar ? aoOrdenar(b.dataset.coluna, nova) : tabelaOrdenavel(tabela);
  });
}

// ------------------------------------------------------------------ busca global (todas as páginas)
function iniciarBusca() {
  const input = $("#busca-global"), lista = $("#busca-resultados");
  if (!input) return;
  // no topo do computador o campo fica estreito: troca o texto de exemplo por um mais curto que caiba inteiro
  // sem os alertas, a busca não traz fornecedores (as páginas deles não existem)
  const exemplos = [input.placeholder, ALERTAS ? "Nome ou empresa" : "Nome", "Buscar"];
  const caber = () => {
    const s = getComputedStyle(input), estilo = getComputedStyle(input, "::placeholder");
    const livre = input.getBoundingClientRect().width - ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"]
      .reduce((soma, p) => soma + parseFloat(s[p]), 0) - 16;  // 16: o botão de limpar do campo de busca ocupa espaço
    const pena = (caber.c ??= document.createElement("canvas").getContext("2d"));
    pena.font = `${estilo.fontSize} ${estilo.fontFamily}`;
    input.placeholder = exemplos.find(t => pena.measureText(t).width <= livre) ?? exemplos.at(-1);
  };
  caber();
  document.fonts?.ready.then(caber);  // mede de novo com a fonte do site, não com a de reserva
  addEventListener("resize", caber);
  let indice = null, itens = [], selecionado = -1;
  const abrir = aberta => { lista.hidden = !aberta; input.setAttribute("aria-expanded", String(aberta)); };
  const carregar = async () => indice ??= (await json("dados/busca.json")).filter(i => ALERTAS || i.t !== "f")
    .map(i => ({ ...i, b: normalizar(i.n + " " + i.s) }));
  // um arquivo por letra inicial de cada parte do nome: acha a pessoa também pelo sobrenome
  const pessoas = {};
  // sem os alertas, o vínculo de sócio (que leva à página do fornecedor) fica de fora
  const carregarPessoas = async letra => pessoas[letra] ??= (ALERTAS || EQUIPE ? await json(`dados/pessoas/${letra}.json`).catch(() => []) : [])
    .map(([n, v]) => ({ n, v: ALERTAS ? v : v.filter(x => !String(x[3] || "").startsWith("fornecedor/")), b: normalizar(n) }))
    .filter(p => p.v.length);
  const TIPO = { d: "Deputado", s: "Senador", f: "Fornecedor", p: "Pessoa" };

  async function desenhar() {
    const q = normalizar(input.value.trim());
    if (!q || !indice) { abrir(false); return; }
    const termos = q.split(/\s+/);
    itens = indice.filter(i => termos.every(t => i.b.includes(t))).slice(0, 6);
    const longo = termos.find(t => t.length >= 3 && /^[a-z]/.test(t));
    if (longo) {
      const achadas = (await carregarPessoas(longo[0])).filter(p => termos.every(t => p.b.includes(t)));
      if (normalizar(input.value.trim()) !== q) return;  // a pessoa continuou digitando
      for (const p of achadas.slice(0, 4)) {
        const ambos = p.v.some(v => v[0] === "s") && p.v.some(v => v[0] === "g");
        p.v.slice(0, 3).forEach(([tipo, onde, como, u]) => itens.push({ t: "p", n: p.n, u,
          s: `${tipo === "s" ? "sócio(a) de" : "gabinete de"} ${onde} · ${como}${ambos ? " · aparece como sócio(a) e como funcionário(a); nome igual não prova que é a mesma pessoa" : ""}` }));
      }
    }
    itens = itens.slice(0, 10);
    selecionado = itens.length ? 0 : -1;
    lista.innerHTML = itens.map((i, k) => `<li><a href="${RAIZ}${i.u}" role="option" aria-selected="${k === 0}">
        <span class="tipo">${TIPO[i.t]}</span><span>${esc(i.n)}<small>${esc(i.s)}</small></span></a></li>`).join("")
      || `<li class="vazio">Nada encontrado para “${esc(input.value)}”. Tente o nome de um deputado, de um senador${ALERTAS ? ", de uma empresa" : ""} ou de uma pessoa.</li>`;
    abrir(true);
  }
  input.addEventListener("focus", carregar, { once: true });
  input.addEventListener("input", async () => { await carregar(); await desenhar(); });
  input.addEventListener("keydown", e => {
    const links = [...lista.querySelectorAll("a")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      selecionado = (selecionado + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
      links.forEach((a, k) => a.setAttribute("aria-selected", String(k === selecionado)));
    } else if (e.key === "Enter" && links[selecionado]) {
      location.href = links[selecionado].href;
    } else if (e.key === "Escape") {
      abrir(false); input.blur();
    }
  });
  document.addEventListener("click", e => { if (!e.target.closest(".busca")) abrir(false); });
  document.addEventListener("keydown", e => {
    if (e.key === "/" && document.activeElement.tagName !== "INPUT") { e.preventDefault(); input.focus(); }
  });
}

// ------------------------------------------------------------------ mapa do Brasil
async function carregarMapa(area) {
  area.insertAdjacentHTML("afterbegin", await (await fetch(`${RAIZ}assets/mapa.svg?v=${VERSAO}`)).text());
  const svg = $("svg", area);
  svg.dataset.inicial = svg.getAttribute("viewBox");
  return svg;
}

function animarViewBox(svg, destino) {
  const inicio = svg.getAttribute("viewBox").split(" ").map(Number);
  if (SEM_MOVIMENTO) { svg.setAttribute("viewBox", destino.join(" ")); return; }
  const t0 = performance.now(), duracao = 650;
  const suave = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  (function passo(agora) {
    const t = Math.min(1, (agora - t0) / duracao), k = suave(t);
    svg.setAttribute("viewBox", inicio.map((v, i) => v + (destino[i] - v) * k).join(" "));
    if (t < 1) requestAnimationFrame(passo);
  })(t0);
}

function enquadrar(svg, uf) {
  if (!uf) { animarViewBox(svg, svg.dataset.inicial.split(" ").map(Number)); return; }
  const b = $(`.uf[data-uf="${uf}"]`, svg).getBBox();
  const [, , W, H] = svg.dataset.inicial.split(" ").map(Number);
  const lado = Math.max(b.width * 1.9, b.height * 1.9 * W / H, 180);
  const w = lado, h = lado * H / W;
  animarViewBox(svg, [b.x + b.width / 2 - w / 2, b.y + b.height / 2 - h / 2, w, h]);
}

// cinco faixas pelos quintis dos valores; null = sem dados
function faixas(valores) {
  const ordenados = Object.values(valores).filter(v => v !== null).sort((a, b) => a - b);
  const q = p => ordenados[Math.min(ordenados.length - 1, Math.floor(p * ordenados.length))];
  const cortes = [.2, .4, .6, .8].map(q);
  return v => v === null || v === undefined ? "vazio" : cortes.filter(c => v > c).length;
}

function dicaNoMapa(area, svg, conteudo) {
  const dica = document.createElement("div");
  dica.className = "dica"; dica.hidden = true; dica.setAttribute("role", "status");
  area.append(dica);
  const mostrar = (uf, x, y) => {
    const html = conteudo(uf);
    if (!html) { dica.hidden = true; return; }
    dica.innerHTML = html; dica.hidden = false;
    dica.style.left = `${x}px`; dica.style.top = `${y}px`;
  };
  svg.addEventListener("pointermove", e => {
    const p = e.target.closest(".uf");
    if (!p) { dica.hidden = true; return; }
    const r = area.getBoundingClientRect();
    mostrar(p.dataset.uf, e.clientX - r.left, e.clientY - r.top);
  });
  svg.addEventListener("pointerleave", () => dica.hidden = true);
  svg.addEventListener("focusin", e => {
    const p = e.target.closest(".uf"); if (!p) return;
    const r = area.getBoundingClientRect(), b = p.getBoundingClientRect();
    mostrar(p.dataset.uf, b.left - r.left + b.width / 2, b.top - r.top + b.height / 3);
  });
  svg.addEventListener("focusout", () => dica.hidden = true);
}

// ------------------------------------------------------------------ gráficos
// Os gráficos são desenhados na largura real do contêiner (texto nítido) e refeitos quando ela muda.
const redesenhos = new Map();
const observador = new ResizeObserver(entradas => entradas.forEach(e => {
  const r = redesenhos.get(e.target);
  if (r && Math.abs(e.contentRect.width - r.largura) > 8) r.desenhar();
}));
function largura(el) { return Math.max(300, Math.floor(el.clientWidth - 32)); }
function lembrar(el, desenhar) {
  redesenhos.set(el, { desenhar, largura: el.clientWidth });
  observador.observe(el);
}

function graficoLinha(el, meses, valores, opcoes = {}) {
  const { altura = 230, destaque = null, limites = null, aoClicar = null, parciais = 0 } = opcoes;
  lembrar(el, () => graficoLinha(el, meses, valores, opcoes));
  const L = largura(el), H = altura, m = { e: 58, d: 12, t: 22, b: 26 };
  const max = Math.max(...valores, ...(limites || []).filter(Boolean), 1);
  const passo = Math.pow(10, Math.floor(Math.log10(max)));
  const topo = Math.ceil(max / passo) * passo;
  const x = i => m.e + i * (L - m.e - m.d) / Math.max(1, valores.length - 1);
  const y = v => H - m.b - v / topo * (H - m.t - m.b);
  const linha = valores.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const grade = [0, .25, .5, .75, 1].map(f => `<line class="grade" x1="${m.e}" x2="${L - m.d}" y1="${y(topo * f)}" y2="${y(topo * f)}"/>
    <text class="eixo" x="${m.e - 8}" y="${y(topo * f) + 4}" text-anchor="end">${brlCurto(topo * f).replace("R$ ", "")}</text>`).join("");
  const anos = meses.map((a, i) => [a, i]).filter(([a]) => a % 100 === 1).map(([a, i]) =>
    `<line class="grade" x1="${x(i)}" x2="${x(i)}" y1="${m.t}" y2="${H - m.b}" stroke-dasharray="2 4"/>
     <text class="eixo" x="${x(i) + 4}" y="${H - 8}">${Math.floor(a / 100)}</text>`).join("");
  const iMax = valores.indexOf(Math.max(...valores));
  const passoX = (L - m.e - m.d) / Math.max(1, valores.length - 1);
  const alvos = valores.map((v, i) => `<rect class="alvo" data-i="${i}" x="${x(i) - passoX / 2}" y="${m.t}" width="${passoX}" height="${H - m.t - m.b}"/>`).join("");
  const faixa = destaque && destaque.length && destaque.length < valores.length
    ? `<rect class="faixa-sel" x="${x(destaque[0]) - passoX / 2}" y="${m.t}" width="${(destaque.length) * passoX}" height="${H - m.t - m.b}"/>` : "";
  const iParcial = valores.length - parciais;
  const faixaParcial = parciais > 0 && iParcial > 0 ? `<rect class="parcial" x="${x(iParcial) - passoX / 2}" y="${m.t}"
      width="${L - m.d - x(iParcial) + passoX / 2}" height="${H - m.t - m.b}"/>
    <text class="rot-parcial" x="${L - m.d}" y="${m.t - 8}" text-anchor="end">incompleto</text>` : "";
  const linhaLimite = limites ? `<path class="limite-g" d="${limites.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v || 0).toFixed(1)}`).join("")}"/>` : "";
  el.innerHTML = `<svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Gasto mensal; pico em ${nomeMes(meses[iMax])} com ${brl(valores[iMax])}">
    <defs><pattern id="hachura" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="hachura-traco" x1="0" y1="0" x2="0" y2="6"/></pattern></defs>
    ${grade}${anos}${faixaParcial}${faixa}${linhaLimite}
    <path class="area" d="${linha}L${x(valores.length - 1)},${y(0)}L${x(0)},${y(0)}Z"/>
    <path class="linha-g" d="${linha}"/>
    <circle class="ponto" cx="${x(iMax)}" cy="${y(valores[iMax])}" r="4.5"/>
    <text class="eixo" x="${x(iMax)}" y="${y(valores[iMax]) - 10}" text-anchor="${iMax > valores.length * .8 ? "end" : "middle"}">pico: ${nomeMes(meses[iMax])}</text>
    <g class="cursor" style="display:none"><line class="marca-v" y1="${m.t}" y2="${H - m.b}"/><circle class="ponto" r="4"/></g>
    ${alvos}</svg><div class="dica" hidden></div>`;
  const svg = $("svg", el), cursor = $(".cursor", el), dica = $(".dica", el);
  svg.addEventListener("pointermove", e => {
    const r = e.target.closest(".alvo"); if (!r) return;
    const i = +r.dataset.i;
    cursor.style.display = "";
    $("line", cursor).setAttribute("x1", x(i)); $("line", cursor).setAttribute("x2", x(i));
    $("circle", cursor).setAttribute("cx", x(i)); $("circle", cursor).setAttribute("cy", y(valores[i]));
    const caixa = svg.getBoundingClientRect(), escala = caixa.width / L;
    dica.innerHTML = `<strong>${nomeMesLongo(meses[i])}</strong>${brl(valores[i])}` +
      (limites && limites[i] ? `<br><small>${pct(valores[i] / limites[i])} do limite mensal</small>` : "") +
      (i >= iParcial ? `<br><small>mês ainda recebendo notas</small>` : "");
    dica.hidden = false;
    dica.style.left = `${16 + x(i) * escala}px`; dica.style.top = `${6 + y(valores[i]) * escala}px`;
  });
  svg.addEventListener("pointerleave", () => { cursor.style.display = "none"; dica.hidden = true; });
  if (aoClicar) svg.addEventListener("click", e => { const r = e.target.closest(".alvo"); if (r) aoClicar(+r.dataset.i); });
}

function graficoBarras(el, itens, { ativos = new Set(), aoClicar } = {}) {
  lembrar(el, () => graficoBarras(el, itens, { ativos, aoClicar }));
  const L = largura(el), linhaH = 30, H = itens.length * linhaH + 4, rot = 132;
  const max = Math.max(...itens.map(i => i.v), 1);
  el.innerHTML = `<svg viewBox="0 0 ${L} ${H}" role="group" aria-label="Gasto por partido">${itens.map((it, k) => {
    const w = Math.max(2, it.v / max * (L - rot - 92));
    return `<g tabindex="0" role="button" aria-pressed="${ativos.has(it.chave)}" data-chave="${esc(it.chave)}"
        aria-label="${esc(it.rotulo)}: ${brl(it.v)}">
      <text class="rot-barra" x="0" y="${k * linhaH + 19}">${esc(it.rotulo)}</text>
      <rect class="barra-g${ativos.has(it.chave) ? " ativa" : ""}" x="${rot}" y="${k * linhaH + 6}" width="${w}" height="18" rx="4"/>
      <text class="val-barra" x="${rot + w + 8}" y="${k * linhaH + 19}">${esc(it.valor)}</text></g>`;
  }).join("")}</svg>`;
  if (aoClicar) {
    const acionar = e => { const g = e.target.closest("[data-chave]"); if (g) aoClicar(g.dataset.chave); };
    el.onclick = acionar;
    el.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); acionar(e); } };
  }
}

// Várias linhas no mesmo eixo, uma por tipo de gasto. Cada série traz `cor` (1 a 8, ou 0 para "Outros"): a cor
// segue o tipo no site inteiro, e esconder uma linha na legenda não repinta as outras. Com o cursor num mês, a dica
// lista o valor de cada linha; "Ver em tabela" mostra os mesmos números sem depender da cor.
function graficoLinhas(el, meses, series, opcoes = {}) {
  const { altura = 300, parciais = 0 } = opcoes;
  const ocultas = opcoes.ocultas || (opcoes.ocultas = new Set());
  const tabelaAberta = !!el.querySelector("details[open]");
  lembrar(el, () => graficoLinhas(el, meses, series, opcoes));
  const visiveis = series.filter(s => !ocultas.has(s.nome));
  const L = largura(el), H = altura, m = { e: 58, d: 12, t: 22, b: 26 };
  const todos = visiveis.flatMap(s => s.valores);
  const max = Math.max(1, ...todos), min = Math.min(0, ...todos);
  // marcas "redondas" (1, 2, 2,5 ou 5 × 10ⁿ); o eixo só desce abaixo de zero se o negativo pesar de verdade:
  // um estorno de R$ 13 mil num mês de R$ 15 milhões não justifica meia escala vazia
  const bruto = (max - min) / 4, ordem = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 2.5, 5, 10].map(f => f * ordem).find(p => p >= bruto);
  const topo = Math.ceil(max / passo) * passo, base = min < -0.03 * max ? Math.floor(min / passo) * passo : 0;
  const x = i => m.e + i * (L - m.e - m.d) / Math.max(1, meses.length - 1);
  const y = v => H - m.b - (v - base) / (topo - base) * (H - m.t - m.b);
  const cor = s => `var(--serie-${s.cor || "outros"})`;
  const caminho = s => s.valores.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const marcas = Array.from({ length: Math.round((topo - base) / passo) + 1 }, (_, k) => base + k * passo);
  const grade = marcas.map(v =>
    `<line class="grade" x1="${m.e}" x2="${L - m.d}" y1="${y(v)}" y2="${y(v)}"/>
     <text class="eixo" x="${m.e - 8}" y="${y(v) + 4}" text-anchor="end">${brlCurto(v).replace("R$ ", "")}</text>`).join("");
  const anos = meses.map((a, i) => [a, i]).filter(([a]) => a % 100 === 1).map(([a, i]) =>
    `<line class="grade" x1="${x(i)}" x2="${x(i)}" y1="${m.t}" y2="${H - m.b}" stroke-dasharray="2 4"/>
     <text class="eixo" x="${x(i) + 4}" y="${H - 8}">${Math.floor(a / 100)}</text>`).join("");
  const passoX = (L - m.e - m.d) / Math.max(1, meses.length - 1);
  const iParcial = meses.length - parciais;
  const faixaParcial = parciais > 0 && iParcial > 0 ? `<rect fill="url(#hachura-linhas)" x="${x(iParcial) - passoX / 2}" y="${m.t}"
      width="${L - m.d - x(iParcial) + passoX / 2}" height="${H - m.t - m.b}"/>
    <text class="rot-parcial" x="${L - m.d}" y="${m.t - 8}" text-anchor="end">incompleto</text>` : "";
  const alvos = meses.map((_, i) => `<rect class="alvo" data-i="${i}" x="${x(i) - passoX / 2}" y="${m.t}" width="${passoX}" height="${H - m.t - m.b}"/>`).join("");
  const legenda = `<div class="legenda-series" role="group" aria-label="Mostrar ou esconder linhas">${series.map((s, i) =>
    `<button type="button" class="serie t${i % 3}" aria-pressed="${!ocultas.has(s.nome)}" data-nome="${esc(s.nome)}" style="--cor:${cor(s)}"><i aria-hidden="true"></i>${esc(s.nome)}</button>`).join("")}</div>`;
  const soma = i => series.reduce((t, s) => t + s.valores[i], 0);
  const tabela = `<details class="tabela-serie"${tabelaAberta ? " open" : ""}><summary>Ver em tabela</summary>
    <div class="rolagem tabela-alta"><table><tr><th>Mês</th>${series.map(s => `<th class="n">${esc(s.nome)}</th>`).join("")}<th class="n">Total</th></tr>
    ${meses.map((mes, i) => `<tr><td>${nomeMes(mes)}</td>${series.map(s => `<td class="n">${brl(s.valores[i])}</td>`).join("")}
      <td class="n">${brl(soma(i))}</td></tr>`).reverse().join("")}</table></div></details>`;
  el.innerHTML = `${legenda}<div class="plano"><svg viewBox="0 0 ${L} ${H}" role="img"
      aria-label="Gasto mensal por tipo: ${esc(visiveis.map(s => s.nome).join(", "))}. Os valores estão na tabela abaixo.">
    <defs><pattern id="hachura-linhas" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="hachura-traco" x1="0" y1="0" x2="0" y2="6"/></pattern></defs>
    ${grade}${anos}${faixaParcial}
    ${visiveis.map(s => `<path class="linha-s" style="--cor:${cor(s)}"${["", ' stroke-dasharray="7 4"', ' stroke-dasharray="2 4"'][series.indexOf(s) % 3]} d="${caminho(s)}"/>`).join("")}
    <g class="cursor" style="display:none"><line class="marca-v" y1="${m.t}" y2="${H - m.b}"/>
      ${visiveis.map(s => `<circle class="ponto-s" r="4" style="--cor:${cor(s)}"/>`).join("")}</g>
    ${alvos}</svg><div class="dica" hidden></div></div>${tabela}`;
  const svg = $("svg", el), cursor = $(".cursor", el), dica = $(".dica", el), pontos = [...cursor.querySelectorAll("circle")];
  svg.addEventListener("pointermove", e => {
    const r = e.target.closest(".alvo"); if (!r) return;
    const i = +r.dataset.i;
    cursor.style.display = "";
    $("line", cursor).setAttribute("x1", x(i)); $("line", cursor).setAttribute("x2", x(i));
    pontos.forEach((p, k) => { p.setAttribute("cx", x(i)); p.setAttribute("cy", y(visiveis[k].valores[i])); });
    const linhas = visiveis.map(s => [s, s.valores[i]]).sort((a, b) => b[1] - a[1]);
    dica.innerHTML = `<strong>${nomeMesLongo(meses[i])}</strong>` + linhas.map(([s, v]) =>
      `<span class="linha-dica" style="--cor:${cor(s)}"><i></i>${esc(s.nome)}<b>${brl(v)}</b></span>`).join("") +
      (linhas.length > 1 ? `<span class="linha-dica total">Total<b>${brl(linhas.reduce((t, [, v]) => t + v, 0))}</b></span>` : "") +
      (i >= iParcial ? `<small>mês ainda recebendo notas</small>` : "");
    // a dica fica ao lado do cursor, do lado com mais espaço, para não cobrir as linhas do mês
    const escala = svg.getBoundingClientRect().width / L, direita = x(i) < L / 2;
    dica.hidden = false;
    dica.style.left = `${x(i) * escala}px`; dica.style.top = `${(H / 2) * escala}px`;
    dica.style.translate = direita ? "14px -50%" : "calc(-100% - 14px) -50%";
  });
  svg.addEventListener("pointerleave", () => { cursor.style.display = "none"; dica.hidden = true; });
  el.onclick = e => {
    const b = e.target.closest(".serie"); if (!b) return;
    const nome = b.dataset.nome;
    if (ocultas.has(nome)) ocultas.delete(nome);
    else if (series.length - ocultas.size > 1) ocultas.add(nome);  // sempre sobra uma linha
    graficoLinhas(el, meses, series, opcoes);
  };
}

// páginas de gastos: a de cada tipo tem uma linha só; a geral, uma linha por tipo
function iniciarGastos() {
  const um = $("#dados-gasto"), varios = $("#dados-gastos");
  if (um) {
    const d = JSON.parse(um.textContent);
    graficoLinha($("#gasto-mensal"), d.meses, d.valores, { altura: 240, parciais: d.parciais });
  }
  if (varios) {
    const d = JSON.parse(varios.textContent);
    graficoLinhas($("#gastos-mensal"), d.meses, d.series, { parciais: d.parciais });
  }
  iniciarTipos();
  iniciarRestaurantes();
  iniciarPostos();
  iniciarFornecedores();
}

// página Postos: a lista inteira vem de dados/postos.json; a busca filtra por nome, cidade ou CNPJ, o seletor pelo
// estado da sede, e cada posto, ao abrir, mostra o ano a ano, o mês a mês e os gabinetes que apresentaram notas dele.
// Sem JavaScript ficam os maiores, já no HTML
async function iniciarPostos() {
  const lista = $("#postos");
  if (!lista) return;
  const busca = $("#posto-busca"), resumo = $("#posto-resumo"), mais = $("#posto-mais"), ordem = $("#posto-ordem"), uf = $("#posto-uf");
  const LOTE = 50;
  let limite = LOTE, dados;
  try { dados = await json("dados/postos.json"); }
  catch { resumo.textContent = "Não foi possível carregar a lista completa; abaixo, os maiores."; return; }
  $("#posto-filtros").hidden = false;
  // p: nome, CNPJ (só dígitos), cidade/UF, UF, total, notas, página de fornecedor, número de gabinetes; o resto
  // (gabinetes, ano a ano, mês a mês) fica em dados/postos/<UF>.json, baixado ao abrir um posto daquele estado
  const itens = dados.p.map((p, i) => ({ p, i, texto: normalizar(`${p[0]} ${p[2]}`), digitos: p[1] }));
  const criterios = { total: (a, b) => b.p[4] - a.p[4], notas: (a, b) => b.p[5] - a.p[5] || b.p[4] - a.p[4],
    gabinetes: (a, b) => b.p[7] - a.p[7] || b.p[4] - a.p[4] };
  const cnpj = d => d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : d;
  const porUF = {};
  const detalhes = uf => porUF[uf] ??= json(`dados/postos/${uf || "sem-uf"}.json`);
  const plural = (n, um, varios) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
  const reais = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const dataBR = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "";

  function desenhar() {
    const q = normalizar(busca.value.trim()), qDigitos = busca.value.replace(/\D/g, ""), estado = uf.value;
    const achados = itens.filter(x => (!estado || x.p[3] === estado)
      && (!q || x.texto.includes(q) || (qDigitos.length >= 3 && x.digitos.includes(qDigitos)))).sort(criterios[ordem.value] || criterios.total);
    const total = achados.reduce((t, x) => t + x.p[4], 0);
    // os totais da lista vêm em reais inteiros: a soma sai sem centavos para não fingir uma precisão que não tem
    resumo.textContent = `${plural(achados.length, q || estado ? "posto encontrado" : "posto", q || estado ? "postos encontrados" : "postos")} · ${reais(total)} no total`;
    lista.innerHTML = achados.slice(0, limite).map(({ p, i }) => `<li><details class="forn" data-i="${i}">
      <summary><span class="forn-l1"><span class="forn-nome">${esc(p[0])}</span></span>
      <span class="forn-meta">${p[2] ? `${esc(p[2])} · ` : ""}${plural(p[5], "nota", "notas")} · ${plural(p[7], "gabinete", "gabinetes")} ·
      <b>${reais(p[4])}</b></span></summary>
      <div class="rest-gab rolagem"></div></details></li>`).join("")
      || `<li class="lt-vazio">Nenhum posto com esse nome, cidade ou CNPJ.</li>`;
    mais.hidden = achados.length <= limite;
  }
  // toggle não sobe pela árvore: a escuta é na captura
  lista.addEventListener("toggle", async e => {
    const d = e.target;
    if (!(d instanceof HTMLDetailsElement) || !d.open || d.dataset.feito || d.dataset.i === undefined) return;
    d.dataset.feito = "1";
    const p = dados.p[+d.dataset.i], caixa = d.querySelector(".rest-gab");
    caixa.innerHTML = `<p class="forn-meta">Carregando…</p>`;
    let det;
    try { det = (await detalhes(p[3]))[p[1]]; } catch { det = null; }
    if (!det) { caixa.innerHTML = `<p class="forn-meta">Não foi possível carregar este posto.</p>`; delete d.dataset.feito; return; }
    const [gabinetes, porAno, porMes] = det;
    const forn = linkEmpresa(p[1], p[6]);
    const anos = porAno.map(([a, v]) => `<tr><td>${a}</td><td class="n">${reais(v)}</td></tr>`).join("");
    const meses = porMes.slice().reverse().map(([m, v]) => `<tr><td>${nomeMes(m)}</td><td class="n">${reais(v)}</td></tr>`).join("");
    caixa.innerHTML = `<p class="forn-meta">${forn}<span class="mono">${esc(cnpj(p[1]))}</span></p>
      <table><tr><th>Ano</th><th class="n">Reembolsado</th></tr>${anos}</table>
      <details class="tabela-serie"><summary>Mês a mês</summary><table><tr><th>Mês da nota</th><th class="n">Reembolsado</th></tr>${meses}</table></details>
      <table><tr><th>Deputado(a)</th><th class="n">Notas</th><th class="n">Total</th></tr>${gabinetes.map(([pid, n, t, ini, fim]) => {
        const [nome, partido, sigla] = dados.d[pid];
        return `<tr><td><a href="${RAIZ}deputado/${pid}.html">${esc(nome)}</a> <span class="cat">${esc(partido)}/${esc(sigla)}</span>
          ${ini ? `<br><span class="cat">${ini === fim ? dataBR(ini) : `${dataBR(ini)} a ${dataBR(fim)}`}</span>` : ""}</td>
          <td class="n">${n.toLocaleString("pt-BR")}</td><td class="n">${reais(t)}</td></tr>`;
      }).join("")}</table>`;
  }, true);
  busca.addEventListener("input", () => { limite = LOTE; desenhar(); });
  ordem.addEventListener("change", () => { limite = LOTE; desenhar(); });
  uf.addEventListener("change", () => { limite = LOTE; desenhar(); });
  mais.addEventListener("click", () => { limite += LOTE; desenhar(); });
  desenhar();
}

// página Fornecedores: dados/fornecedores/<UF>.json, um arquivo por estado do fornecedor, baixado quando o estado é
// escolhido ("Todo o Brasil" baixa todos). Cada linha é [fornecedor, tipo, aaaamm, notas, soma, maior nota]: os filtros
// de ano, mês e tipo escolhem as linhas, e a lista soma as de cada fornecedor. Sem JavaScript ficam os maiores
async function iniciarFornecedores() {
  const lista = $("#fornecedores"), cfg = $("#dados-fornecedores");
  if (!lista || !cfg) return;
  const { ufs } = JSON.parse(cfg.textContent);
  const campo = id => $(`#fo-${id}`), resumo = campo("resumo"), mais = campo("mais");
  const LOTE = 50, cache = {};
  let limite = LOTE, achados = [], pedido = 0;
  const plural = (n, um, varios) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
  const carregar = uf => cache[uf] ??= json(`dados/fornecedores/${uf}.json`).then(d => {
    d.f.forEach(f => { f.texto = normalizar(`${f[0]} ${f[2]}`); f.digitos = f[1].replace(/\D/g, ""); });
    return d;
  });
  const ordens = { total: (a, b) => b.total - a.total, maior: (a, b) => b.maior - a.maior || b.total - a.total,
                   notas: (a, b) => b.notas - a.notas || b.total - a.total,
                   media: (a, b) => b.total / b.notas - a.total / a.notas || b.total - a.total };

  async function filtrar() {
    const meu = ++pedido, uf = campo("uf").value, ano = +campo("ano").value || 0, mes = +campo("mes").value || 0;
    const tipo = campo("tipo").value === "" ? -1 : +campo("tipo").value;
    resumo.textContent = "Carregando…";
    let grupos;
    try { grupos = await Promise.all((uf ? [uf] : ufs).map(carregar)); }
    catch { resumo.textContent = "Não foi possível carregar os fornecedores; abaixo, os maiores do período inteiro."; return; }
    if (meu !== pedido) return;  // outro filtro foi escolhido enquanto este carregava
    const q = normalizar(campo("busca").value.trim()), qDigitos = campo("busca").value.replace(/\D/g, "");
    achados = [];
    for (const g of grupos) {
      const soma = new Map();
      for (const [f, t, m, n, s, maior] of g.l) {
        if ((tipo >= 0 && t !== tipo) || (ano && Math.floor(m / 100) !== ano) || (mes && m % 100 !== mes)) continue;
        const x = soma.get(f) || soma.set(f, { f: g.f[f], total: 0, notas: 0, maior: 0 }).get(f);
        x.total += s; x.notas += n; x.maior = Math.max(x.maior, maior);
      }
      for (const x of soma.values())
        if (!q || x.f.texto.includes(q) || (qDigitos.length >= 3 && x.f.digitos.includes(qDigitos))) achados.push(x);
    }
    achados.sort(ordens[campo("ordem").value] || ordens.total);
    const total = achados.reduce((t, x) => t + x.total, 0);
    resumo.textContent = `${plural(achados.length, "fornecedor", "fornecedores")} · ${brl2(total)} no total`;
    limite = LOTE;
    desenhar();
  }

  // uma linha por fornecedor, com uma coluna para cada número; o título da coluna que ordena a lista fica marcado
  function desenhar() {
    lista.innerHTML = achados.slice(0, limite).map(({ f, total, notas, maior }) => {
      const url = enderecoEmpresa(f.digitos, f[3]);
      return `<tr><td class="forn-quem">${url ? `<a href="${url}">${esc(f[0])}</a>` : esc(f[0])}<br><span class="mono cat">${esc(f[1])}</span></td>
        <td>${esc(f[2] || "—")}</td><td class="n">${notas.toLocaleString("pt-BR")}</td><td class="n">${brl2(total / notas)}</td>
        <td class="n">${brl2(maior)}</td><td class="n forn-total">${brl2(total)}</td></tr>`;
    }).join("") || `<tr><td colspan="6" class="vazio">Nenhum fornecedor com esses filtros.</td></tr>`;
    mais.hidden = achados.length <= limite;
    if (!mais.hidden) mais.textContent = `Mostrar mais ${Math.min(LOTE, achados.length - limite)} de ${(achados.length - limite).toLocaleString("pt-BR")} restantes`;
    document.querySelectorAll("#fo-tabela th[data-ordem]").forEach(th =>
      th.setAttribute("aria-sort", th.dataset.ordem === campo("ordem").value ? "descending" : "none"));
  }
  // tocar no título de uma coluna de número ordena por ela (a lista inteira, não só as linhas já mostradas)
  document.querySelectorAll("#fo-tabela th[data-ordem]").forEach(th => {
    th.tabIndex = 0;
    const ordenar = () => { campo("ordem").value = th.dataset.ordem; filtrar(); };
    th.addEventListener("click", ordenar);
    th.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ordenar(); } });
  });

  campo("filtros").hidden = false;
  campo("ano").addEventListener("change", () => {
    campo("mes").disabled = !campo("ano").value;
    if (!campo("ano").value) campo("mes").value = "";
  });
  for (const id of ["uf", "ano", "mes", "tipo", "ordem"]) campo(id).addEventListener("change", filtrar);
  campo("busca").addEventListener("input", filtrar);
  mais.addEventListener("click", () => { limite += LOTE; desenhar(); });
  filtrar();
}

// página Restaurantes: a lista inteira vem de dados/restaurantes.json; a busca filtra por nome, cidade ou CNPJ, e cada
// restaurante, ao abrir, mostra os gabinetes que consumiram lá. A lista sai pelo total, pelo valor médio por nota (só
// os que têm o mínimo de notas do data-minimo) ou pelo número de notas. Sem JavaScript ficam os maiores, já no HTML
async function iniciarRestaurantes() {
  const lista = $("#restaurantes");
  if (!lista) return;
  const busca = $("#rest-busca"), resumo = $("#rest-resumo"), mais = $("#rest-mais"), ordem = $("#rest-ordem");
  const LOTE = 50, minimo = +ordem.dataset.minimo;
  let limite = LOTE, dados;
  try { dados = await json("dados/restaurantes.json"); }
  catch { resumo.textContent = "Não foi possível carregar a lista completa; abaixo, os maiores."; return; }
  $("#rest-filtros").hidden = false;
  // a média só conta as notas de valor positivo (r[7]): a linha de devolução não a puxa para baixo
  const itens = dados.r.map((r, i) => ({ r, i, texto: normalizar(`${r[0]} ${r[2]}`), digitos: r[1].replace(/\D/g, ""),
    media: r[7] ? r[3] / r[7] : 0 }));
  const criterios = { total: (a, b) => b.r[3] - a.r[3], media: (a, b) => b.media - a.media, notas: (a, b) => b.r[4] - a.r[4] || b.r[3] - a.r[3] };
  const plural = (n, um, varios) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
  // sem centavos na tabela de gabinetes: no celular, a coluna do total cabe no cartão
  const reais = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  function desenhar() {
    const q = normalizar(busca.value.trim()), qDigitos = busca.value.replace(/\D/g, ""), porMedia = ordem.value === "media";
    const achados = itens.filter(x => (!q || x.texto.includes(q) || (qDigitos.length >= 3 && x.digitos.includes(qDigitos)))
      && (!porMedia || x.r[7] >= minimo)).sort(criterios[ordem.value] || criterios.total);
    resumo.textContent = (q ? plural(achados.length, "restaurante encontrado", "restaurantes encontrados")
      : plural(achados.length, "restaurante", "restaurantes")) + (porMedia ? ` com ${minimo} notas ou mais` : "");
    lista.innerHTML = achados.slice(0, limite).map(({ r, i, media }) => `<li><details class="forn" data-i="${i}">
      <summary><span class="forn-l1"><span class="forn-nome">${esc(r[0])}</span></span>
      <span class="forn-meta">${r[2] ? `${esc(r[2])} · ` : ""}${plural(r[4], "nota", "notas")} · ${plural(r[6].length, "gabinete", "gabinetes")} ·
      ${porMedia ? `<b>média de ${brl2(media)}</b> · ${brl2(r[3])} no total` : `<b>${brl2(r[3])}</b>${r[7] ? ` · média de ${brl2(media)}` : ""}`}</span></summary>
      <div class="rest-gab rolagem"></div></details></li>`).join("")
      || `<li class="lt-vazio">Nenhum restaurante com esse nome, cidade ou CNPJ.</li>`;
    mais.hidden = achados.length <= limite;
  }
  // toggle não sobe pela árvore: a escuta é na captura
  lista.addEventListener("toggle", e => {
    const d = e.target;
    if (!(d instanceof HTMLDetailsElement) || !d.open || d.dataset.feito || d.dataset.i === undefined) return;
    d.dataset.feito = "1";
    const r = dados.r[+d.dataset.i];
    const forn = linkEmpresa(r[1].replace(/\D/g, ""), r[5]);
    d.querySelector(".rest-gab").innerHTML = `<p class="forn-meta">${forn}<span class="mono">${esc(r[1])}</span></p>
      <table><tr><th>Deputado(a)</th><th class="n">Notas</th><th class="n">Total</th></tr>${r[6].map(([pid, n, t]) => {
        const [nome, partido, uf] = dados.d[pid];
        return `<tr><td><a href="${RAIZ}deputado/${pid}.html">${esc(nome)}</a> <span class="cat">${esc(partido)}/${esc(uf)}</span></td>
          <td class="n">${n.toLocaleString("pt-BR")}</td><td class="n">${reais(t)}</td></tr>`;
      }).join("")}</table>`;
  }, true);
  busca.addEventListener("input", () => { limite = LOTE; desenhar(); });
  ordem.addEventListener("change", () => { limite = LOTE; desenhar(); });
  mais.addEventListener("click", () => { limite += LOTE; desenhar(); });
  desenhar();
}

// página Gastos: a lista numerada leva direto à página de cada tipo. Um endereço com #tipo= (links antigos) ainda abre
// um painel com os gabinetes que gastaram com o tipo e os indícios das notas desse tipo
// (dados/gastos/<tipo>.json, baixado na hora; os nomes vêm de alertas-meta.json). Sobe de baixo no
// celular e abre como gaveta à direita no computador, como o painel do perfil. O endereço guarda o tipo e o gabinete
// abertos (#tipo=, &gab=): o Voltar do navegador volta uma vista ou fecha o painel. Sem <dialog>, o link leva à
// página do tipo
function iniciarTipos() {
  const fonte = $("#dados-tipos");
  if (!fonte || typeof HTMLDialogElement !== "function" || !("showModal" in HTMLDialogElement.prototype)) return;
  const TIPOS = JSON.parse(fonte.textContent);
  const N_TIPOS = Object.keys(TIPOS).length;
  const GRAV = { 3: "Alta", 2: "Média", 1: "Baixa" };
  const LOTE = 40;
  const mil = n => n.toLocaleString("pt-BR");
  const plural = (n, um, varios) => `${mil(n)} ${n === 1 ? um : varios}`;
  const porcento = v => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  let meta = null;
  const cache = {};
  // sem os alertas não há alertas-meta.json: os nomes vêm de deputados.json, e o painel mostra só os gabinetes
  const carregarMeta = () => ALERTAS
    ? json("dados/alertas-meta.json").then(m => ({
      dep: m.deputados, regra: Object.fromEntries(m.regras.map(r => [r.codigo, r.titulo])) }))
    : json("dados/deputados.json").then(l => ({
      dep: Object.fromEntries(l.map(d => [d.id, { nome: d.n, partido: d.p, uf: d.uf }])), regra: {} }));
  const carregar = slug => cache[slug] ??= Promise.all([json(`dados/gastos/${slug}.json`), meta ??= carregarMeta()])
    .catch(erro => { delete cache[slug]; meta = null; throw erro; });

  const caixa = document.createElement("dialog");
  caixa.className = "ficha-indicio painel-tipo";
  caixa.setAttribute("aria-labelledby", "pt-titulo");
  caixa.innerHTML = `<div class="fi-cab"><button type="button" class="fi-voltar seta-e" hidden>Voltar</button>
    <div class="fi-titulos"><p class="rotulo" id="pt-rotulo"></p><h2 id="pt-titulo" tabindex="-1"></h2></div>
    <button type="button" class="fi-fechar" aria-label="Fechar o painel">×</button></div>
    <div class="fi-corpo" id="pt-corpo"></div><p class="vh" id="pt-anuncio" aria-live="polite"></p>`;
  document.body.appendChild(caixa);
  const rotulo = $("#pt-rotulo", caixa), titulo = $("#pt-titulo", caixa), corpo = $("#pt-corpo", caixa);
  const voltar = $(".fi-voltar", caixa), anuncio = $("#pt-anuncio", caixa);

  // o que o leitor escolheu dentro do tipo (aba, busca, ordem, filtro): volta igual da ficha do gabinete
  const inicial = () => ({ aba: "gab", q: "", ordem: "valor", so: false, filtro: "", limite: LOTE, rolagem: 0, deGab: null });
  const est = { slug: null, origem: null, dados: null, ...inicial() };
  let vez = 0;
  const profundidade = () => (history.state && history.state.pt) || 0;
  const doEndereco = () => {
    const h = new URLSearchParams(location.hash.slice(1));
    return TIPOS[h.get("tipo")] ? { slug: h.get("tipo"), gab: h.get("gab") } : null;
  };
  const semHash = () => location.pathname + location.search;

  function abrirGab(pid, de) {
    est.rolagem = corpo.scrollTop;
    est.deGab = de && de.dataset.gab ? `[data-gab="${de.dataset.gab}"]${de.closest(".pt-ind") ? "" : ".gab-linha"}` : null;
    history.pushState({ pt: profundidade() + 1 }, "", `#tipo=${est.slug}&gab=${pid}`);
    mostrar();
  }
  function fechar() {
    const n = profundidade();
    if (n > 0) history.go(-n); else concluir();
  }
  function concluir() {
    if (caixa.open) caixa.close();
    const o = est.origem;
    est.origem = null;
    if (o && o.isConnected) o.focus();
  }
  // endereço com #tipo= ao abrir a página (ou trocado à mão): a entrada da página fica sem ele e o painel ganha as suas
  function linkDireto() {
    const v = doEndereco();
    if (!v) return;
    if (profundidade() === 0) {
      history.replaceState(null, "", semHash());
      history.pushState({ pt: 1 }, "", `#tipo=${v.slug}`);
      if (v.gab) history.pushState({ pt: 2 }, "", `#tipo=${v.slug}&gab=${v.gab}`);
    }
    est.origem = $(`.tipo-linha[href="gastos/${v.slug}.html"]`);
    mostrar();
  }

  async function mostrar({ voltando = false } = {}) {
    const v = doEndereco();
    if (!v) return concluir();
    if (v.slug !== est.slug) Object.assign(est, inicial(), { slug: v.slug, dados: null });
    const t = TIPOS[v.slug], minha = ++vez;
    voltar.hidden = !v.gab || profundidade() < 2;
    if (!v.gab) { rotulo.textContent = `Tipo de gasto · ${t.pos}º de ${N_TIPOS}`; titulo.textContent = t.nome; }
    if (!caixa.open) caixa.showModal();
    if (!est.dados) {
      if (v.gab) { rotulo.textContent = t.nome; titulo.textContent = "Carregando…"; }
      corpo.innerHTML = `<p class="fi-meta">${ALERTAS ? "Carregando os gabinetes e os indícios deste tipo…" : "Carregando os gabinetes deste tipo…"}</p>`;
      try { est.dados = await carregar(v.slug); }
      catch {
        if (minha !== vez) return;
        corpo.innerHTML = `<p class="fi-aviso">Não foi possível carregar os dados agora.</p>
          <button type="button" class="botao secundario pequeno" data-acao="tentar">Tentar de novo</button>`;
        return;
      }
      if (minha !== vez) return;
    }
    if (v.gab) vistaGab(t, v.gab);
    else vistaTipo(t);
    if (!v.gab && voltando) {
      corpo.scrollTop = est.rolagem;
      const alvo = est.deGab && corpo.querySelector(est.deGab);
      if (alvo) { alvo.focus({ preventScroll: true }); return; }
    } else corpo.scrollTop = 0;
    titulo.focus();
  }

  // ---- vista do tipo: números, abas Gabinetes e Indícios
  function vistaTipo(t) {
    const [d] = est.dados;
    corpo.innerHTML = `<div class="pt-numeros" style="--cor: var(--serie-${t.cor || "outros"})">
        <div><b>${brlCurto(t.total)}</b><span>${porcento(t.pct)} da cota</span></div>
        <div><b>${mil(t.gab)}</b><span>${t.gab === 1 ? "gabinete usou" : "gabinetes usaram"}</span></div>
        ${ALERTAS ? `<div><b>${mil(t.ind)}</b><span>${t.ind === 1 ? "indício" : "indícios"}${t.conf ? ` · ${plural(t.conf, "confirmado", "confirmados")}` : ""}</span></div>`
          : `<div><b>${mil(t.notas || 0)}</b><span>${t.notas === 1 ? "nota" : "notas"}</span></div>`}</div>
      ${t.desc ? `<p class="fi-desc">${esc(t.desc)}</p>` : ""}
      ${t.outros ? `<p class="fi-aviso">Nos gráficos por tipo, este gasto entra na soma de “Outros”.</p>` : ""}
      ${ALERTAS ? `<div class="pt-abas" role="tablist" aria-label="O que mostrar">
        <button type="button" role="tab" id="pt-aba-gab" data-aba="gab" aria-controls="pt-painel">Gabinetes <span class="num">${mil(d.g.length)}</span></button>
        <button type="button" role="tab" id="pt-aba-ind" data-aba="ind" aria-controls="pt-painel">Indícios <span class="num">${mil(d.a.length)}</span></button>
      </div>` : ""}
      <div id="pt-painel"${ALERTAS ? ` role="tabpanel"` : ""}><div id="pt-controles"></div><div id="pt-lista"></div></div>
      <a class="botao secundario pequeno pt-pagina" href="gastos/${est.slug}.html">Página do tipo: fornecedores e mês a mês</a>`;
    desenharAba();
  }

  function desenharAba() {
    const [d] = est.dados;
    corpo.querySelectorAll("[data-aba]").forEach(b => {
      const sim = b.dataset.aba === est.aba;
      b.setAttribute("aria-selected", sim);
      b.tabIndex = sim ? 0 : -1;
    });
    if (ALERTAS) $("#pt-painel", corpo).setAttribute("aria-labelledby", `pt-aba-${est.aba}`);
    const controles = $("#pt-controles", corpo);
    if (est.aba === "gab" || !ALERTAS) {
      const comInd = d.g.filter(g => g[3]).length;
      controles.innerHTML = `<div class="filtros pt-filtros">
          <input type="search" id="pt-busca" placeholder="Buscar deputado, partido ou UF" aria-label="Buscar gabinete" value="${esc(est.q)}">
          <select id="pt-ordem" aria-label="Ordem da lista">
            <option value="valor">Maior gasto</option>${ALERTAS ? `<option value="ind">Mais indícios</option>` : ""}<option value="nome">Nome (A a Z)</option></select>
          ${ALERTAS ? `<button type="button" class="chip" id="pt-so" aria-pressed="${est.so}"${comInd ? "" : " disabled"}>Só com indícios<span class="num">${mil(comInd)}</span></button>` : ""}
        </div>`;
      $("#pt-ordem", controles).value = est.ordem;
    } else {
      const conta = { "": d.a.length, conf: d.a.filter(a => a.s === "confirmado").length,
        3: d.a.filter(a => a.g === 3).length, 2: d.a.filter(a => a.g === 2).length, 1: d.a.filter(a => a.g === 1).length };
      const chip = (valor, nome) => `<button type="button" class="chip" data-filtro="${valor}" aria-pressed="${est.filtro === valor}"${conta[valor] || est.filtro === valor ? "" : " disabled"}>${nome}<span class="num">${mil(conta[valor])}</span></button>`;
      controles.innerHTML = d.a.length ? `<p class="fi-meta pt-explica">Indício é o que uma regra automática apontou numa nota.
          Só os marcados como confirmados foram conferidos na revisão; os outros ainda não são conclusão.</p>
        <div class="pt-chips">${chip("", "Todos")}${chip("conf", "Confirmados")}${chip("3", "Alta")}${chip("2", "Média")}${chip("1", "Baixa")}</div>
        <div class="filtros pt-filtros"><input type="search" id="pt-busca" placeholder="Buscar deputado, partido, UF ou texto" aria-label="Buscar indício" value="${esc(est.q)}"></div>` : "";
    }
    desenharLista();
  }

  function desenharLista() {
    const [d, m] = est.dados;
    const lista = $("#pt-lista", corpo), q = normalizar(est.q).trim();
    const dep = id => m.dep[id] || { nome: `Deputado ${id}`, partido: "", uf: "" };
    // "PL/SP", como a lista mostra, ou "PL SP"
    const quem = d => `${d.nome} ${d.partido}/${d.uf} ${d.partido} ${d.uf}`;
    let itens, total, html;
    if (est.aba === "gab") {
      const maior = d.g.length ? d.g[0][1] || 1 : 1;
      itens = d.g.map((g, i) => ({ pid: g[0], v: g[1], notas: g[2], ind: g[3], pos: i + 1, d: dep(g[0]) }))
        .filter(g => (!est.so || g.ind) && (!q || normalizar(quem(g.d)).includes(q)));
      if (est.ordem === "ind") itens.sort((a, b) => b.ind - a.ind || b.v - a.v);
      else if (est.ordem === "nome") itens.sort((a, b) => a.d.nome.localeCompare(b.d.nome, "pt-BR"));
      total = itens.length;
      html = itens.slice(0, est.limite).map(g => `<li><button type="button" class="gab-linha" data-gab="${g.pid}">
          <span class="gl-pos num" title="Posição no gasto deste tipo">${g.pos}º</span>
          <span class="gl-txt"><b>${esc(g.d.nome)}</b><small>${esc(g.d.partido)}/${esc(g.d.uf)} · ${plural(g.notas, "nota", "notas")}</small>
            <span class="gl-trilho" aria-hidden="true"><span style="width:${Math.max(100 * g.v / maior, .8).toFixed(1)}%"></span></span></span>
          <span class="gl-dir"><span class="gl-v num">${brlCurto(g.v)}</span>${ALERTAS && g.ind ? `<span class="gl-ind">${plural(g.ind, "indício", "indícios")}</span>` : ""}</span>
          <span class="seta" aria-hidden="true"></span></button></li>`).join("");
      html = html ? `<ol class="pt-gabs">${html}</ol>` : `<p class="fi-aviso">Nenhum gabinete com esse filtro.</p>`;
    } else {
      itens = d.a.filter(a => (!est.filtro || (est.filtro === "conf" ? a.s === "confirmado" : a.g === +est.filtro)) &&
        (!q || normalizar(`${quem(dep(a.p))} ${a.t} ${m.regra[a.r] || ""}`).includes(q)));
      total = itens.length;
      html = !d.a.length ? `<p class="fi-aviso">Nenhum indício apontado nas notas deste tipo de gasto.</p>`
        : itens.slice(0, est.limite).map(a => cartaoIndicio(a, true)).join("") || `<p class="fi-aviso">Nenhum indício com esse filtro.</p>`;
    }
    const resto = total - est.limite;
    lista.innerHTML = html + (resto > 0 ? `<button type="button" class="botao secundario pequeno pt-mais" data-acao="mais">
      Mostrar mais ${mil(Math.min(LOTE, resto))} (faltam ${mil(resto)})</button>` : "");
    anuncio.textContent = est.aba === "gab" ? plural(total, "gabinete", "gabinetes") : plural(total, "indício", "indícios");
  }

  function cartaoIndicio(a, comNome) {
    const [, m] = est.dados, d = m.dep[a.p] || { nome: `Deputado ${a.p}`, partido: "", uf: "" };
    const revisao = a.s === "confirmado" ? `<span class="pill confirmado">${esc(a.rl || "Confirmado na revisão")}</span>`
      : a.s ? `<span class="pill apontado">${esc(a.rl || "Revisado")}</span>` : `<span class="fi-escopo">revisão pendente</span>`;
    return `<article class="fi-motivo pt-ind">
      <div class="fi-motivo-cab"><span class="pill g${a.g}">${GRAV[a.g]}</span>${revisao}</div>
      <h4>${esc(m.regra[a.r] || a.r)}</h4>
      ${comNome ? `<p class="fi-meta"><button type="button" class="fi-link pt-quem" data-gab="${a.p}">${esc(d.nome)}</button> ${esc(d.partido)}/${esc(d.uf)}</p>` : ""}
      <p class="pt-valor"><b class="num">${brl(a.v)}</b> em ${plural(a.n, "nota", "notas")} deste tipo</p>
      <p class="fi-desc">${esc(a.t)}</p>
      <a class="fi-link" href="alerta/${esc(a.c)}.html">Abrir o indício: notas, regra e revisão</a></article>`;
  }

  // ---- vista do gabinete: quanto gastou no tipo, comparado à média, e os indícios dele nesse tipo
  function vistaGab(t, pid) {
    const [d, m] = est.dados;
    const i = d.g.findIndex(g => String(g[0]) === String(pid));
    const dep = m.dep[pid] || { nome: `Deputado ${pid}`, partido: "", uf: "" };
    titulo.textContent = dep.nome;
    if (i < 0) {
      rotulo.textContent = t.nome;
      corpo.innerHTML = `<p class="fi-aviso">Este gabinete não tem notas deste tipo de gasto.</p>`;
      return;
    }
    const [, v, notas] = d.g[i], media = t.total / d.g.length, maior = Math.max(d.g[0][1], 1);
    const razao = v / media;
    const comparacao = razao >= 1.1 ? `${razao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} vezes a média dos gabinetes`
      : razao <= .9 ? `${porcento(100 * razao)} da média dos gabinetes` : "perto da média dos gabinetes";
    const lista = (d.a || []).filter(a => String(a.p) === String(pid));
    rotulo.textContent = `${t.nome} · ${i + 1}º de ${d.g.length}`;
    corpo.innerHTML = `<p class="fi-meta">${esc(dep.partido)}/${esc(dep.uf)} · ${i + 1}º maior gasto deste tipo, entre ${plural(d.g.length, "gabinete", "gabinetes")}</p>
      <div class="pt-numeros" style="--cor: var(--serie-${t.cor || "outros"})">
        <div><b>${brlCurto(v)}</b><span>neste tipo</span></div>
        <div><b>${mil(notas)}</b><span>${notas === 1 ? "nota" : "notas"}</span></div>
        <div><b>${porcento(100 * v / t.total)}</b><span>do total do tipo</span></div></div>
      <div class="pt-compara">
        <p>Gastou <strong>${brl(v)}</strong>, ${comparacao}.</p>
        <div class="pt-escala" role="img" aria-label="Gasto do gabinete comparado à média e ao maior gasto deste tipo">
          <span class="pt-barra" style="width:${Math.max(100 * v / maior, .8).toFixed(1)}%"></span>
          <span class="pt-media" style="left:${(100 * media / maior).toFixed(1)}%"></span></div>
        <p class="pt-legenda"><span><i class="pt-marca" aria-hidden="true"></i>média ${brlCurto(media)}</span><span>maior gasto ${brlCurto(maior)}</span></p>
      </div>
      ${ALERTAS ? `<h3>Indícios nas notas deste tipo (${mil(lista.length)})</h3>
      ${lista.map(a => cartaoIndicio(a, false)).join("") || `<p class="fi-aviso">Nenhum indício apontado nas notas deste tipo de gasto deste gabinete.</p>`}` : ""}
      <div class="fi-acoes"><a class="botao pequeno" href="deputado/${esc(pid)}.html">Abrir o perfil do deputado</a></div>`;
  }

  // ---- eventos
  corpo.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.aba && b.dataset.aba !== est.aba) {
      Object.assign(est, { aba: b.dataset.aba, q: "", limite: LOTE });
      desenharAba();
    } else if (b.dataset.gab) abrirGab(b.dataset.gab, b);
    else if (b.dataset.filtro !== undefined) {
      est.filtro = est.filtro === b.dataset.filtro ? "" : b.dataset.filtro;
      est.limite = LOTE;
      corpo.querySelectorAll("[data-filtro]").forEach(c => c.setAttribute("aria-pressed", c.dataset.filtro === est.filtro));
      desenharLista();
    } else if (b.id === "pt-so") {
      est.so = !est.so; est.limite = LOTE;
      b.setAttribute("aria-pressed", est.so);
      desenharLista();
    } else if (b.dataset.acao === "mais") {
      const antes = est.limite;
      est.limite += LOTE;
      desenharLista();
      // o foco vai ao primeiro item novo, e não volta ao topo
      const novo = corpo.querySelectorAll("#pt-lista .gab-linha, #pt-lista .pt-ind")[antes];
      if (novo) (novo.matches("button") ? novo : $(".fi-link, a", novo) || novo).focus();
    } else if (b.dataset.acao === "tentar") mostrar();
  });
  // setas entre as abas, como numa lista de abas
  corpo.addEventListener("keydown", e => {
    const b = e.target.closest("[data-aba]");
    if (!b || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const outra = corpo.querySelector(`[data-aba="${b.dataset.aba === "gab" ? "ind" : "gab"}"]`);
    outra.click();
    outra.focus();
  });
  corpo.addEventListener("input", e => {
    if (e.target.id === "pt-busca") { est.q = e.target.value; est.limite = LOTE; desenharLista(); }
    else if (e.target.id === "pt-ordem") { est.ordem = e.target.value; est.limite = LOTE; desenharLista(); }
  });
  voltar.addEventListener("click", () => history.back());
  $(".fi-fechar", caixa).addEventListener("click", fechar);
  // o véu fecha, só quando o toque também começou nele (uma seleção de texto que sai da caixa termina no <dialog>)
  let comecouNoVeu = false;
  caixa.addEventListener("pointerdown", e => { comecouNoVeu = e.target === caixa; });
  caixa.addEventListener("click", e => { if (comecouNoVeu && e.target === caixa) fechar(); comecouNoVeu = false; });
  // no Android, o Voltar do sistema chega como pedido de fechamento: com a ficha do gabinete aberta, volta ao tipo
  let porEsc = false;
  caixa.addEventListener("keydown", e => { porEsc = e.key === "Escape"; });
  caixa.addEventListener("cancel", e => {
    if (!porEsc && profundidade() > 1 && e.cancelable) { e.preventDefault(); history.back(); }
    porEsc = false;
  });
  caixa.addEventListener("close", () => { if (profundidade() > 0) fechar(); });
  addEventListener("popstate", () => {
    const v = doEndereco();
    if (v && profundidade() > 0) mostrar({ voltando: true });
    else if (v) linkDireto();
    else concluir();
  });
  linkDireto();
}

// confirmados na revisão em destaque; os apontados pelas regras (médios e altos, quase todos sem revisão), à parte e
// em tom neutro: a lista não pode ler como acusação o que ninguém conferiu. Sem os alertas, nada (nem o <br> antes)
function pills(d) {
  if (!ALERTAS) return "";
  const apontados = d.g3 + d.g2;
  const p = [];
  if (d.k) p.push(`<span class="pill confirmado">${d.k} confirmado${d.k > 1 ? "s" : ""}</span>`);
  if (apontados) p.push(`<span class="pill apontado" title="${d.g3} de gravidade alta e ${d.g2} de gravidade média">${apontados} apontado${apontados > 1 ? "s" : ""}</span>`);
  return `<br><span class="pills">${p.join("") || `<span class="pill apontado">nenhum alerta médio ou alto</span>`}</span>`;
}

// ------------------------------------------------------------------ cada deputado, um ponto
// Média mensal de reembolsos (meses com despesa) de quem tem pelo menos seis meses; os pontos de valores próximos
// se empilham acima e abaixo do eixo, como grãos. Na página do deputado, o dele fica destacado.
const MESES_MINIMOS = 6;
function mediaMensal(d) {
  const ativos = d.m.filter(v => v > 0);
  return ativos.length ? { v: ativos.reduce((s, v) => s + v, 0) / ativos.length, n: ativos.length } : null;
}

function graficoPontos(el, deputados, opcoes = {}) {
  const { destaque = null, achados = null, casa = "d" } = opcoes;
  const quem = casa === "s" ? "senadores" : "deputados";
  lembrar(el, () => graficoPontos(el, deputados, opcoes));
  const itens = deputados.map(d => ({ d, ...mediaMensal(d) }))
    .filter(x => x.v && (x.n >= MESES_MINIMOS || String(x.d.id) === destaque)).sort((a, b) => a.v - b.v);
  if (!itens.length) { el.innerHTML = ""; return; }
  const L = Math.max(280, el.clientWidth), estreito = L < 560;
  const r = estreito ? 2.3 : 3.2, passo = r * 2 + (estreito ? .6 : 1);
  const m = { e: 6, d: 6 };
  const ordenados = itens.map(x => x.v);
  const mediana = ordenados[Math.floor(ordenados.length / 2)];
  // o eixo vai até o percentil 99,5; os poucos acima ficam na borda, marcados com uma seta
  const teto = ordenados[Math.min(ordenados.length - 1, Math.floor(ordenados.length * .995))];
  const degrau = teto > 60000 ? 20000 : 10000;
  const max = Math.ceil(teto / degrau) * degrau;
  const x = v => m.e + Math.min(v, max) / max * (L - m.e - m.d);
  // empilha por coluna: 0, +1, -1, +2, -2...
  const colunas = new Map();
  itens.forEach(it => {
    const c = Math.round(x(it.v) / passo);
    const k = colunas.get(c) || 0; colunas.set(c, k + 1);
    it.c = c; it.k = k % 2 ? -Math.ceil(k / 2) : k / 2;
    it.px = c * passo;
  });
  const alto = Math.max(...[...colunas.values()]);
  const meio = Math.ceil(alto / 2) * passo + 18;
  const H = meio * 2 + 22;
  itens.forEach(it => { it.py = meio + it.k * passo; });
  const ticks = [];
  for (let t = 0; t <= max; t += estreito ? degrau * 2 : degrau) ticks.push(t);
  const termo = normalizar(achados || "");
  const achou = it => termo && it.d.b.includes(termo);
  const nAchados = termo ? itens.filter(achou).length : 0;
  const alvo = itens.find(it => String(it.d.id) === destaque);
  const circulos = itens.map((it, i) => `<circle class="p${String(it.d.id) === destaque ? " destaque" : ""}${achou(it) ? " achado" : ""}" data-i="${i}"
    cx="${it.px.toFixed(1)}" cy="${it.py.toFixed(1)}" r="${String(it.d.id) === destaque || achou(it) ? r * 1.9 : r}" style="--c:${it.c}"/>`).join("");
  const rotuloAlvo = (it, texto) => {
    const fim = it.px > L * .7, ini = it.px < L * .3;
    return `<g class="rotulo-ponto"><line x1="${it.px}" x2="${it.px}" y1="${it.py - r * 2.4}" y2="12"/>
      <text x="${it.px + (fim ? -6 : ini ? 6 : 0)}" y="8" text-anchor="${fim ? "end" : ini ? "start" : "middle"}">${esc(texto)}</text></g>`;
  };
  const marcados = alvo ? rotuloAlvo(alvo, `${alvo.d.n}: ${brlCurto(alvo.v)} por mês`)
    : nAchados === 1 ? rotuloAlvo(itens.find(achou), `${itens.find(achou).d.n}: ${brlCurto(itens.find(achou).v)}`) : "";
  el.classList.toggle("buscando", !!termo);
  el.innerHTML = `<svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Média mensal de reembolsos de ${itens.length} ${quem}: mediana de ${brl(mediana)}${alvo ? `; ${esc(alvo.d.n)} tem ${brl(alvo.v)}` : ""}">
    <line class="mediana" x1="${x(mediana)}" x2="${x(mediana)}" y1="14" y2="${H - 22}"/>
    ${alvo || nAchados === 1 ? "" : `<text class="rot-mediana" x="${x(mediana) + 6}" y="10">mediana ${brlCurto(mediana)}</text>`}
    ${ticks.map(t => `<text class="eixo" x="${x(t)}" y="${H - 4}" text-anchor="${t === 0 ? "start" : t === max ? "end" : "middle"}">${t ? brlCurto(t).replace("R$ ", "") : "R$ 0"}</text>`).join("")}
    <g class="nuvem">${circulos}</g>${marcados}</svg><div class="dica" hidden></div>`;
  const svg = $("svg", el), dica = $(".dica", el);
  let atual = null;
  const perto = e => {
    const caixa = svg.getBoundingClientRect(), k = L / caixa.width;
    const px = (e.clientX - caixa.left) * k, py = (e.clientY - caixa.top) * k;
    let melhor = null, dist = (passo * 2.2) ** 2;
    for (const it of itens) { const dd = (it.px - px) ** 2 + (it.py - py) ** 2; if (dd < dist) { dist = dd; melhor = it; } }
    return [melhor, caixa.width / L];
  };
  svg.addEventListener("pointermove", e => {
    const [it, escala] = perto(e);
    if (atual) atual.classList.remove("sob");
    if (!it) { dica.hidden = true; svg.style.cursor = ""; atual = null; return; }
    atual = svg.querySelector(`circle[data-i="${itens.indexOf(it)}"]`); atual.classList.add("sob");
    svg.style.cursor = "pointer";
    dica.innerHTML = `<strong>${esc(it.d.n)}</strong>${esc(it.d.p)} · ${esc(it.d.uf)}<br><b class="num">${brl(it.v)}</b> por mês<small>média de ${it.n} ${it.n === 1 ? "mês" : "meses"} com despesas</small>`;
    dica.hidden = false;
    dica.style.left = `${it.px * escala}px`; dica.style.top = `${it.py * escala}px`;
  });
  svg.addEventListener("pointerleave", () => { dica.hidden = true; if (atual) atual.classList.remove("sob"); atual = null; });
  svg.addEventListener("click", e => { const [it] = perto(e); if (it) location.href = `${RAIZ}${it.d.url || `deputado/${it.d.id}.html`}`; });
}

async function iniciarPontos() {
  const el = $("#pontos"); if (!el) return;
  const desenhar = async () => {
    const deputados = await json("dados/deputados.json");
    const destaque = el.dataset.destaque || null;
    const busca = $("#pontos-busca");
    graficoPontos(el, deputados, { destaque });
    busca?.addEventListener("input", () => graficoPontos(el, deputados, { destaque, achados: busca.value.trim() }));
  };
  // no modo econômico, o arquivo de todos os deputados (~110 KB comprimido) só com um toque; o foco fica na caixa do
  // gráfico (o botão some), e uma falha de rede deixa o botão de novo, para tentar outra vez
  if (el.dataset.destaque && ECONOMIA) {
    const pedir = (texto = "Mostrar a comparação com os outros deputados") => {
      el.innerHTML = `<button type="button" class="botao secundario pequeno">${texto}</button>`;
      el.querySelector("button").addEventListener("click", async () => {
        el.tabIndex = -1; el.focus();
        el.innerHTML = `<p class="cat" role="status">Carregando a comparação…</p>`;
        try { await desenhar(); } catch (erro) { console.error(erro); pedir("Não deu para carregar: tentar de novo"); el.querySelector("button").focus(); }
      }, { once: true });
    };
    pedir();
    return;
  }
  // na página do deputado o arquivo de todos só é baixado quando o gráfico chega perto da tela
  if (!el.dataset.destaque || !("IntersectionObserver" in window)) return desenhar();
  const obs = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { obs.disconnect(); desenhar(); } }, { rootMargin: "300px" });
  obs.observe(el);
}

// ------------------------------------------------------------------ página inicial
// "Comece pela sua cidade", na capa: a lista de cidades só é baixada quando a pessoa toca no campo; escolher uma leva
// à página O voto da sua cidade já aberta nela (#m=<código>). Sem a lista, o formulário segue com o nome (?c=)
function iniciarSuaCidade() {
  const campo = $("#sua-cidade"), lista = $("#sua-cidade-lista");
  if (!campo || !lista) return;
  let cidades = null, pedido = null, sugestoes = [], ativa = -1;
  const carregar = () => pedido || (pedido = json("dados/municipios.json").then(indice => {
    cidades = indice.m.map(([uf, nome, cod]) => ({ uf, nome, cod, b: normalizar(`${nome} ${uf}`) }));
    mostrar();
  }).catch(() => { cidades = []; }));
  const ir = c => { location.href = `${RAIZ}voto-da-cidade.html#m=${c.cod}`; };
  function fechar() { lista.hidden = true; campo.setAttribute("aria-expanded", "false"); campo.removeAttribute("aria-activedescendant"); ativa = -1; }
  function mostrar() {
    const q = normalizar(campo.value.trim());
    if (!cidades || q.length < 3) { sugestoes = []; lista.hidden = true; campo.setAttribute("aria-expanded", "false"); return; }
    // primeiro as que começam com o que foi digitado, das de nome mais curto para as de nome mais longo ("campin"
    // traz Campinas antes de Campinápolis); depois as que só contêm o texto
    const ordem = c => (normalizar(c.nome).startsWith(q) ? 0 : 1000) + c.nome.length;
    sugestoes = cidades.filter(c => c.b.includes(q)).sort((x, y) => ordem(x) - ordem(y) || x.b.localeCompare(y.b)).slice(0, 6);
    lista.innerHTML = sugestoes.map((c, i) => `<li role="option" id="sc-op-${i}" data-cod="${c.cod}" aria-selected="${i === ativa}">
      <span><b>${esc(c.nome)}</b><small>${NOMES_UF[c.uf] || c.uf}</small></span></li>`).join("")
      || `<li class="vazio">Nenhuma cidade com esse nome.</li>`;
    lista.hidden = false;
    campo.setAttribute("aria-expanded", "true");
  }
  campo.addEventListener("focus", carregar);
  campo.addEventListener("input", () => { ativa = -1; carregar(); mostrar(); });
  campo.addEventListener("keydown", ev => {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      if (!sugestoes.length) return;
      ev.preventDefault();
      ativa = (ativa + (ev.key === "ArrowDown" ? 1 : -1) + sugestoes.length) % sugestoes.length;
      mostrar(); campo.setAttribute("aria-activedescendant", `sc-op-${ativa}`);
    } else if (ev.key === "Escape") fechar();
  });
  // Enter ou o botão Ver: com sugestão na lista, vai direto à cidade; sem ela, o formulário manda o nome digitado
  campo.form.addEventListener("submit", ev => { const s = sugestoes[Math.max(ativa, 0)]; if (s) { ev.preventDefault(); ir(s); } });
  lista.addEventListener("click", ev => { const li = ev.target.closest("[data-cod]"); if (li) ir(cidades.find(c => c.cod === +li.dataset.cod)); });
  document.addEventListener("click", ev => { if (!ev.target.closest(".sua-cidade")) fechar(); });
}

// A capa, capítulo "Ache o seu deputado ou senador": uma lista só com as duas casas, cada linha com a marca da sua
// (Deputado ou Senador), e os botões Todos / Deputados / Senadores, que escolhem o que aparece. Os deputados vêm de
// dados/deputados.json; os senadores, de dados/senadores.json ({c: código, n: nome, p: partido, uf, x: em exercício,
// t: total, f: foto, s: suplência, g: "F" nas senadoras, m: o reembolsado em cada mês de resumo.meses_senado}). O
// estado se escolhe nas 27 siglas ou no mapa, que só é baixado quando o botão "Escolher no mapa" o abre (em tela larga
// ele já vem aberto). Os gráficos embaixo seguem o que está na lista.
const POR_VEZ_INICIO = 12;
const rotuloCasa = x => x.casa === "s" ? (x.g === "F" ? "Senadora" : "Senador") : (x.g === "F" ? "Deputada" : "Deputado");
// os senadores no formato dos deputados (id, n, p, uf, f, x, t, m, b), com a casa e o endereço da página de cada um
const comoParlamentares = (deputados, senadores) => [
  ...deputados.map(d => ({ ...d, casa: "d", url: `deputado/${d.id}.html` })),
  ...senadores.map(s => ({ casa: "s", id: s.c, n: s.n, p: s.p, uf: s.uf, f: s.f, x: !!s.x, t: s.t, m: s.m || [], g: s.g,
    b: normalizar(s.n), sup: s.s, url: `senador/${s.c}.html` })),
];

async function iniciarInicio() {
  iniciarSuaCidade();
  const casas = $("#casas"), pontosSen = $("#pontos-senado");
  const [deputados, resumo, senadores] = await Promise.all([json("dados/deputados.json"), json("dados/resumo.json"),
    casas || pontosSen ? json("dados/senadores.json").catch(() => []) : []]);
  const todos = comoParlamentares(deputados, senadores);
  const mesesSen = resumo.meses_senado || resumo.meses;
  // onde cada mês do Senado cai na lista de meses da Câmara, a do gráfico (-1: mês que a Câmara ainda não tem)
  const posSen = mesesSen.map(m => resumo.meses.indexOf(m));
  const estado = { casa: "", uf: null, partidos: new Set(), busca: "", ordem: "nome", situacao: "exercicio", metrica: "gasto",
    limite: POR_VEZ_INICIO, periodo: "" };
  const h = new URLSearchParams(location.hash.slice(1));
  if (NOMES_UF[h.get("uf")]) estado.uf = h.get("uf");
  if (h.get("p")) h.get("p").split(",").forEach(p => estado.partidos.add(p));
  if (h.get("per") && indicesPeriodo(resumo.meses, h.get("per")).length) estado.periodo = h.get("per");
  if (casas && ["d", "s"].includes(h.get("c"))) estado.casa = h.get("c");
  opcoesPeriodo($("#periodo"), resumo.meses, estado.periodo);

  // a média mensal dos senadores, um ponto para cada, embaixo da dos deputados; a busca do capítulo marca nos dois
  if (pontosSen) {
    const lista = todos.filter(x => x.casa === "s");
    graficoPontos(pontosSen, lista, { casa: "s" });
    $("#pontos-busca")?.addEventListener("input", e => graficoPontos(pontosSen, lista, { casa: "s", achados: e.target.value.trim() }));
  }

  let idx = [], idxSen = [], porUF = {}, svg = null, mapaPedido = null;
  // valores do parlamentar no período escolhido (os meses do Senado têm a sua lista)
  const idxDe = x => x.casa === "s" ? idxSen : idx;
  const gasto = x => estado.periodo ? somar(x.m, idxDe(x)) : x.t;
  const alertas = x => x.casa === "s" ? { g3: 0, g2: 0, k: 0 } : contarAlertas(x, idx, !estado.periodo);
  const limite = x => x.casa === "s" ? 0 : limiteAtivo(x, idx, resumo.limites);
  const ativoNoPeriodo = x => !estado.periodo || idxDe(x).some(i => x.m[i]);
  const porCasa = x => !estado.casa || x.casa === estado.casa;
  const porSituacao = x => estado.situacao === "todos" || x.x;
  const porPartido = x => !estado.partidos.size || estado.partidos.has(x.p);
  const doRecorte = x => porCasa(x) && porSituacao(x) && porPartido(x) && (!estado.uf || x.uf === estado.uf) && ativoNoPeriodo(x);
  const contar = (n, um, varios) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
  // "513 deputados e 81 senadores", só com a casa que está na lista
  const quantos = lista => {
    const d = lista.filter(x => x.casa === "d").length, s = lista.length - d;
    return [d ? contar(d, "deputado", "deputados") : "", s ? contar(s, "senador", "senadores") : ""].filter(Boolean).join(" e ");
  };
  const nomeDaCasa = () => estado.casa === "d" ? "Câmara" : estado.casa === "s" ? "Senado" : casas ? "Câmara e Senado" : "Câmara";

  function calcularUFs() {
    porUF = {};
    for (const uf of Object.keys(NOMES_UF)) {
      const lista = todos.filter(x => x.uf === uf && porCasa(x) && porSituacao(x) && porPartido(x) && ativoNoPeriodo(x));
      const total = lista.reduce((s, x) => s + gasto(x), 0);
      const graves = ALERTAS ? lista.reduce((s, x) => { const al = alertas(x); return s + al.g3 + al.g2; }, 0) : 0;
      const lim = lista.reduce((s, x) => s + limite(x), 0);
      const dep = lista.filter(x => x.casa === "d").length;
      porUF[uf] = { n: lista.length, dep, sen: lista.length - dep, total, graves, limite: lim,
        valor: !lista.length ? null : estado.metrica === "gasto" ? total / lista.length : graves / lista.length };
    }
  }

  // as 27 siglas: sem JavaScript são links para a página do estado; aqui escolhem o estado da lista
  const siglas = [...document.querySelectorAll(".ufs a[data-uf]")];
  function desenharSiglas() {
    siglas.forEach(el => el.setAttribute("aria-pressed", String(el.dataset.uf === estado.uf)));
    $("#voltar").hidden = !estado.uf;
  }

  function desenharMapa() {
    calcularUFs();
    const legenda = $("#legenda-texto");
    if (legenda) legenda.textContent = estado.metrica !== "gasto" ? "Alertas graves por deputado"
      : `Gasto médio por ${estado.casa === "d" || !casas ? "deputado" : estado.casa === "s" ? "senador" : "parlamentar"}`;
    if (!svg) return;  // o mapa ainda não foi aberto: as contas por estado já ficam prontas para quando abrir
    const faixa = faixas(Object.fromEntries(Object.entries(porUF).map(([uf, v]) => [uf, v.valor])));
    svg.querySelectorAll(".uf").forEach(p => {
      const v = porUF[p.dataset.uf];
      p.dataset.n = faixa(v.valor);
      p.setAttribute("aria-pressed", String(p.dataset.uf === estado.uf));
      p.setAttribute("aria-label", `${NOMES_UF[p.dataset.uf]}: ${[v.dep ? contar(v.dep, "deputado", "deputados") : "", v.sen ? contar(v.sen, "senador", "senadores") : ""].filter(Boolean).join(" e ") || "ninguém na lista"}, ${brl(v.total)} em reembolsos`);
    });
    svg.querySelectorAll(".sigla").forEach(t => t.classList.toggle("ativa", t.dataset.uf === estado.uf));
    svg.classList.toggle("com-selecao", !!estado.uf);
  }

  function desenharPartidos() {
    const contagem = {};
    todos.filter(x => porCasa(x) && porSituacao(x) && ativoNoPeriodo(x) && (!estado.uf || x.uf === estado.uf)).forEach(x => contagem[x.p] = (contagem[x.p] || 0) + 1);
    estado.partidos.forEach(p => contagem[p] ??= 0);
    $("#partidos").innerHTML = Object.entries(contagem).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
      .map(([p, n]) => `<button type="button" class="chip" data-p="${esc(p)}" aria-pressed="${estado.partidos.has(p)}">${esc(p)}<span class="num">${n}</span></button>`).join("");
    const n = $("#partidos-n");
    if (n) n.textContent = estado.partidos.size ? `: ${[...estado.partidos].join(", ")}` : "";
  }

  function desenharLista() {
    const q = normalizar(estado.busca);
    const lista = todos.filter(x => doRecorte(x) && (!q || x.b.includes(q)))
      .map(x => ({ x, v: gasto(x), a: alertas(x), lim: limite(x) }));
    const ordens = {
      gasto: (p, s) => s.v - p.v || p.x.n.localeCompare(s.x.n, "pt-BR"),
      nome: (p, s) => p.x.n.localeCompare(s.x.n, "pt-BR"),
    };
    // as ordens por alerta só existem com os alertas ligados; uma ordem desconhecida cai no nome (a padrão)
    if (ALERTAS) Object.assign(ordens, {
      confirmados: (p, s) => s.a.k - p.a.k || p.x.n.localeCompare(s.x.n, "pt-BR"),
      alertas: (p, s) => s.a.g3 - p.a.g3 || s.a.g2 - p.a.g2 || s.v - p.v,
    });
    lista.sort(ordens[estado.ordem] || ordens.nome);
    $("#lista-titulo").textContent = estado.uf ? NOMES_UF[estado.uf] : "Brasil";
    $("#lista-estado").hidden = !estado.uf;
    if (estado.uf) { $("#lista-estado").href = `estado/${estado.uf.toLowerCase()}.html`; $("#lista-estado").textContent = `Página ${ARTIGO_UF[estado.uf] ? `d${ARTIGO_UF[estado.uf]}` : "de"} ${NOMES_UF[estado.uf]}`; }
    const total = lista.reduce((s, p) => s + p.v, 0);
    $("#lista-resumo").textContent = lista.length
      ? `${quantos(lista.map(p => p.x))}${estado.situacao === "exercicio" ? " em exercício" : ""} · ${brlCurto(total)} em ${nomePeriodo(estado.periodo)}`
      : "Ninguém com esses filtros";
    $("#linhas").innerHTML = lista.slice(0, estado.limite).map(({ x, v, a, lim }) => `
      <li><a class="linha" href="${x.url}">
        <img class="foto" src="${esc(x.f)}" alt="" loading="lazy" decoding="async" width="44" height="44" ${SEM_FOTO}>
        <span><span class="nome">${esc(x.n)}</span><br><span class="meta"><span class="casa-marca casa-${x.casa}">${rotuloCasa(x)}</span> ${esc(x.p)} · ${esc(x.uf)}${x.casa === "s" ? (x.sup ? ` · ${esc(x.sup)}` : "") : condicao(x)}${x.x || x.c === "a" ? "" : " · fora do exercício"}${estado.periodo && lim ? ` · ${pct(v / lim)} da cota` : ""}</span></span>
        <span class="direita"><span class="total">${brl(v)}</span>${x.casa === "d" ? pills(a) : ""}</span>
      </a></li>`).join("") || `<li class="vazio">Ninguém encontrado. Tire algum filtro de partido, escolha “Todos com despesas” ou limpe a busca.</li>`;
    const resto = lista.length - estado.limite;
    $("#mais").hidden = resto <= 0;
    $("#mais").textContent = `Mostrar mais ${Math.min(POR_VEZ_INICIO * 2, resto)} de ${resto.toLocaleString("pt-BR")} restantes`;
    $("#limpar").hidden = !estado.uf && !estado.partidos.size && !estado.busca;
  }

  function desenharGraficos() {
    // a linha do tempo mostra toda a legislatura e destaca o período escolhido; o Senado entra nos meses da Câmara
    const recorte = todos.filter(x => porCasa(x) && porSituacao(x) && porPartido(x) && (!estado.uf || x.uf === estado.uf));
    const mensal = resumo.meses.map(() => 0);
    recorte.forEach(x => x.m.forEach((v, i) => { const k = x.casa === "s" ? posSen[i] : i; if (v && k >= 0 && k < mensal.length) mensal[k] += v; }));
    const lugar = estado.uf ? NOMES_UF[estado.uf] : "Brasil";
    const partidos = estado.partidos.size ? ` · ${[...estado.partidos].join(", ")}` : "";
    $("#titulo-tempo").textContent = `Reembolsos mês a mês · ${lugar} · ${nomeDaCasa()}${partidos}`;
    graficoLinha($("#linha-tempo"), resumo.meses, mensal, {
      destaque: estado.periodo ? idx : null, parciais: resumo.parciais,
      aoClicar: i => definirPeriodo(estado.periodo === String(resumo.meses[i]) ? "" : String(resumo.meses[i])),
    });

    const somas = {};
    todos.filter(x => porCasa(x) && porSituacao(x) && ativoNoPeriodo(x) && (!estado.uf || x.uf === estado.uf)).forEach(x => {
      somas[x.p] ??= { v: 0, n: 0 }; somas[x.p].v += gasto(x); somas[x.p].n += 1;
    });
    const itens = Object.entries(somas).sort((x, y) => y[1].v - x[1].v).slice(0, 12)
      .map(([p, s]) => ({ chave: p, rotulo: `${p} (${s.n})`, v: s.v, valor: brlCurto(s.v) }));
    $("#titulo-partidos").textContent = `Partidos · ${lugar} · ${nomePeriodo(estado.periodo)}`;
    graficoBarras($("#grafico-partidos"), itens, { ativos: estado.partidos, aoClicar: p => alternarPartido(p) });
  }

  function atualizar({ enquadrarMapa = false } = {}) {
    idx = indicesPeriodo(resumo.meses, estado.periodo);
    idxSen = indicesPeriodo(mesesSen, estado.periodo);
    casas?.querySelectorAll("[data-casa]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.casa === estado.casa)));
    desenharPartidos(); desenharSiglas(); desenharMapa(); desenharLista(); desenharGraficos();
    if (enquadrarMapa && svg) enquadrar(svg, estado.uf);
    const p = new URLSearchParams();
    if (estado.uf) p.set("uf", estado.uf);
    if (estado.casa) p.set("c", estado.casa);
    if (estado.partidos.size) p.set("p", [...estado.partidos].join(","));
    if (estado.periodo) p.set("per", estado.periodo);
    history.replaceState(null, "", p.toString() ? `#${p}` : location.pathname);
  }
  function definirPeriodo(valor) {
    estado.periodo = valor; $("#periodo").value = valor; estado.limite = POR_VEZ_INICIO; atualizar();
  }
  function selecionarUF(uf, rolar = true) {
    estado.uf = estado.uf === uf ? null : uf; estado.limite = POR_VEZ_INICIO;
    atualizar({ enquadrarMapa: true });
    if (rolar && estado.uf && matchMedia("(max-width: 980px)").matches) $(".lista-achar").scrollIntoView({ behavior: SEM_MOVIMENTO ? "auto" : "smooth" });
  }
  function alternarPartido(p) {
    estado.partidos.has(p) ? estado.partidos.delete(p) : estado.partidos.add(p);
    estado.limite = POR_VEZ_INICIO; atualizar();
  }

  // o mapa: baixado na primeira vez em que abre
  const painelMapa = $("#mapa-painel"), botaoMapa = $("#abrir-mapa");
  function abrirMapa(sim) {
    painelMapa.hidden = !sim;
    botaoMapa.setAttribute("aria-expanded", String(sim));
    botaoMapa.querySelector("span").textContent = sim ? "Fechar o mapa" : "Escolher no mapa";
    if (!sim || mapaPedido) return;
    mapaPedido = carregarMapa($("#mapa-area")).then(desenho => {
      svg = desenho;
      svg.addEventListener("click", e => { const p = e.target.closest(".uf"); if (p) selecionarUF(p.dataset.uf); });
      svg.addEventListener("keydown", e => {
        const p = e.target.closest(".uf");
        if (p && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); selecionarUF(p.dataset.uf); }
      });
      dicaNoMapa($("#mapa-area"), svg, uf => {
        const v = porUF[uf];
        return `<strong>${NOMES_UF[uf]}</strong><dl>${v.dep || !casas ? `<dt>Deputados</dt><dd>${v.dep}</dd>` : ""}${v.sen ? `<dt>Senadores</dt><dd>${v.sen}</dd>` : ""}
          <dt>Reembolsos</dt><dd>${brlCurto(v.total)}</dd>
          <dt>Média por ${estado.casa === "d" || !casas ? "deputado" : estado.casa === "s" ? "senador" : "parlamentar"}</dt><dd>${v.n ? brlCurto(v.total / v.n) : "—"}</dd>
          ${v.limite && estado.casa === "d" ? `<dt>Uso da cota</dt><dd>${pct(v.total / v.limite)}</dd>` : ""}${ALERTAS ? `<dt>Alertas graves</dt><dd>${v.graves}</dd>` : ""}</dl>`;
      });
      desenharMapa();
      if (estado.uf) enquadrar(svg, estado.uf);
    }).catch(erro => {
      console.error(erro);
      mapaPedido = null;
      $("#mapa-area").innerHTML = `<p class="vazio">Não foi possível carregar o mapa agora. As siglas acima fazem a mesma escolha.</p>`;
    });
  }
  botaoMapa.hidden = false;
  botaoMapa.addEventListener("click", () => abrirMapa(painelMapa.hidden));

  siglas.forEach(el => {
    el.setAttribute("role", "button");
    el.addEventListener("click", e => { e.preventDefault(); selecionarUF(el.dataset.uf); });
    el.addEventListener("keydown", e => { if (e.key === " ") { e.preventDefault(); selecionarUF(el.dataset.uf); } });
  });
  casas?.addEventListener("click", e => {
    const b = e.target.closest("[data-casa]"); if (!b) return;
    estado.casa = b.dataset.casa; estado.limite = POR_VEZ_INICIO; atualizar();
  });
  $("#periodo").addEventListener("change", e => definirPeriodo(e.target.value));
  $("#voltar").addEventListener("click", () => selecionarUF(estado.uf, false));
  $("#partidos").addEventListener("click", e => { const b = e.target.closest(".chip"); if (b) alternarPartido(b.dataset.p); });
  $("#limpar").addEventListener("click", () => {
    const tinhaUF = !!estado.uf;
    estado.uf = null; estado.partidos.clear(); estado.busca = ""; $("#busca").value = "";
    atualizar({ enquadrarMapa: tinhaUF });
  });
  $("#busca").addEventListener("input", e => { estado.busca = e.target.value; estado.limite = POR_VEZ_INICIO; desenharLista(); });
  if (!ALERTAS) $("#ordem").querySelectorAll('option[value="confirmados"], option[value="alertas"]').forEach(o => o.remove());
  $("#ordem").addEventListener("change", e => { estado.ordem = e.target.value; desenharLista(); });
  $("#situacao").addEventListener("change", e => { estado.situacao = e.target.value; estado.limite = POR_VEZ_INICIO; atualizar(); });
  $("#mais").addEventListener("click", () => { estado.limite += POR_VEZ_INICIO * 2; desenharLista(); });
  // sem os alertas o mapa só se colore pelo gasto, mesmo que um botão "Alertas" tenha sobrado no HTML
  document.querySelectorAll("[data-metrica]").forEach(b => b.addEventListener("click", () => {
    if (!ALERTAS && b.dataset.metrica !== "gasto") return;
    estado.metrica = b.dataset.metrica;
    document.querySelectorAll("[data-metrica]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    desenharMapa();
  }));
  // os partidos ficam recolhidos no celular (são mais de vinte botões); abertos em tela larga ou com um já escolhido
  const caixaPartidos = $("#partidos-caixa");
  if (caixaPartidos) caixaPartidos.open = estado.partidos.size > 0 || matchMedia("(min-width: 761px)").matches;
  atualizar();
  // em tela larga o mapa já vem aberto; quem chega por "Ver no mapa" (#uf=) também o encontra aberto
  if (matchMedia("(min-width: 981px)").matches || estado.uf) abrirMapa(true);
}

// ------------------------------------------------------------------ ranking (deputados e senadores)
// A mesma tela nas duas casas: ranking.html (casa "d") e senadores.html (casa "s"). No Senado não há limite da cota nem
// presença: os itens vêm de dados/senadores.json e os meses, de resumo.meses_senado. O filtro "Tipo de gasto" troca o
// valor de cada um pelo do tipo escolhido: na Câmara, dados/tipos/<índice>.json ({id: [valor por mês]}); no Senado,
// dados/senado-tipos.json ({t: tipos, v: {código: {índice: [valor por mês]}}}). Os dois só são baixados quando pedidos.
async function iniciarRanking(casa = "d") {
  const sen = casa === "s", comPresenca = !sen && PRESENCA;
  const [brutos, resumo, presenca] = await Promise.all([json(sen ? "dados/senadores.json" : "dados/deputados.json"),
    json("dados/resumo.json"), comPresenca ? json("dados/presenca.json").catch(() => ({})) : {}]);
  const deputados = sen ? brutos.map(s => ({ id: s.c, n: s.n, p: s.p, uf: s.uf, f: s.f, x: !!s.x, m: s.m || [], sup: s.s })) : brutos;
  const meses = sen ? (resumo.meses_senado || resumo.meses) : resumo.meses;
  const quem = sen ? "senadores" : "deputados";
  const pagina = d => sen ? `senador/${d.id}.html` : `deputado/${d.id}.html`;
  const meta = d => sen ? esc([d.p, d.uf, d.sup].filter(Boolean).join(" · ")) : `${esc(d.p)} · ${esc(d.uf)}${condicao(d)}`;
  // padrão: o mês mais recente já "fechado" (os últimos ainda recebem notas por até 90 dias)
  const totais = meses.map((_, i) => deputados.reduce((s, d) => s + (d.m[i] || 0), 0));
  const mediana = [...totais].sort((a, b) => a - b)[Math.floor(totais.length / 2)];
  const fechados = totais.map((t, i) => [t, i]).filter(([t]) => t >= .8 * mediana);
  const ultimoFechado = fechados.length ? meses[fechados.pop()[1]] : "";
  const h = new URLSearchParams(location.hash.slice(1));
  const estado = { periodo: h.get("per") ?? String(ultimoFechado), ordem: h.get("o") || "gasto", uf: h.get("uf") || "", partido: h.get("p") || "",
    tipo: h.get("t") || "", limite: 50 };
  opcoesPeriodo($("#r-periodo"), meses, estado.periodo);
  Object.keys(NOMES_UF).sort().forEach(uf => $("#r-uf").insertAdjacentHTML("beforeend", `<option value="${uf}">${NOMES_UF[uf]}</option>`));
  [...new Set(deputados.map(d => d.p).filter(Boolean))].sort().forEach(p => $("#r-partido").insertAdjacentHTML("beforeend", `<option>${esc(p)}</option>`));
  const tem = (seletor, valor) => [...$(seletor).options].some(o => o.value === valor);
  // uma ordem ou um tipo que a página não oferece (endereço antigo, presença fora do site) cai no padrão
  if (!tem("#r-ordem", estado.ordem)) estado.ordem = "gasto";
  if (!tem("#r-tipo", estado.tipo)) estado.tipo = "";
  if (!tem("#r-uf", estado.uf)) estado.uf = "";
  $("#r-ordem").value = estado.ordem; $("#r-uf").value = estado.uf; $("#r-partido").value = estado.partido; $("#r-tipo").value = estado.tipo;

  // o valor de cada gabinete no tipo de gasto escolhido, mês a mês: função id → [valores]
  const arquivosTipo = {};
  async function serieDoTipo(tipo) {
    if (tipo === "") return null;
    if (sen) {
      const d = await (arquivosTipo.senado ??= json("dados/senado-tipos.json"));
      return id => (d.v[id] || {})[tipo] || [];
    }
    const d = await (arquivosTipo[tipo] ??= json(`dados/tipos/${tipo}.json`));
    return id => d[id] || [];
  }

  // presença: [índice do mês, dias com sessão, dias presente, faltas sem justificativa] por deputado
  function desenharPresenca(idx) {
    const conjunto = new Set(idx);
    const linhas = deputados.filter(d => presenca[d.id] && (!estado.uf || d.uf === estado.uf) && (!estado.partido || d.p === estado.partido))
      .map(d => {
        const x = { d, dias: 0, pres: 0, faltas: 0 };
        presenca[d.id].forEach(([i, dias, pres, faltas]) => { if (conjunto.has(i)) { x.dias += dias; x.pres += pres; x.faltas += faltas; } });
        return x;
      })
      .filter(x => x.dias > 0);
    const taxa = x => x.pres / x.dias;
    linhas.sort(estado.ordem === "faltas" ? (a, b) => b.faltas - a.faltas || taxa(a) - taxa(b) : (a, b) => taxa(a) - taxa(b) || b.faltas - a.faltas);
    const barra = x => estado.ordem === "faltas" ? x.faltas : 1 - taxa(x);
    const max = Math.max(...linhas.map(barra), 1e-9);
    const faltas = linhas.reduce((s, x) => s + x.faltas, 0);
    const semFalta = linhas.filter(x => !x.faltas).length;
    $("#r-resumo").textContent = linhas.length
      ? `${linhas.length} deputados em exercício em dias de sessão em ${nomePeriodo(estado.periodo)} · ${faltas.toLocaleString("pt-BR")} faltas sem justificativa no total · ${semFalta} sem nenhuma`
      : "";
    $("#r-lista").innerHTML = linhas.slice(0, estado.limite).map((x, k) => `<li><a href="deputado/${x.d.id}.html#presenca">
        <span class="pos">${k + 1}º</span>
        <img class="foto" src="${esc(x.d.f)}" alt="" loading="lazy" decoding="async" width="44" height="44" ${SEM_FOTO}>
        <span><span class="nome">${esc(x.d.n)}</span><br><span class="meta">${esc(x.d.p)} · ${esc(x.d.uf)}${condicao(x.d)}</span></span>
        <span class="trilho" aria-hidden="true"><span style="width:${(100 * barra(x) / max).toFixed(1)}%"></span></span>
        <span class="valores">${estado.ordem === "faltas" ? `${x.faltas} falta${x.faltas === 1 ? "" : "s"}` : pct(taxa(x))}<small>${estado.ordem === "faltas"
          ? `sem justificativa · ${pct(taxa(x))} de presença` : `de presença · ${x.faltas} falta${x.faltas === 1 ? "" : "s"} sem justificativa`} em ${x.dias} dia${x.dias === 1 ? "" : "s"} de sessão</small></span>
      </a></li>`).join("") || `<li class="vazio">Nenhum dia de sessão no Plenário nesse recorte.</li>`;
    $("#r-mais").hidden = linhas.length <= estado.limite;
  }

  let pedido = 0;
  async function desenhar() {
    const meu = ++pedido;
    const idx = indicesPeriodo(meses, estado.periodo);
    const modoPresenca = comPresenca && (estado.ordem === "faltas" || estado.ordem === "presenca");
    $("#r-titulo").textContent = modoPresenca ? "Quem mais faltou" : sen ? "Quem mais gastou no Senado" : "Quem mais gastou";
    if ($("#r-lead-gasto")) $("#r-lead-gasto").hidden = $("#r-aviso-gasto").hidden = modoPresenca;
    if ($("#r-lead-presenca")) $("#r-lead-presenca").hidden = !modoPresenca;
    $("#r-tipo").disabled = modoPresenca;  // a presença não tem tipo de gasto
    const p = new URLSearchParams({ per: estado.periodo });
    if (estado.ordem !== "gasto") p.set("o", estado.ordem);
    if (estado.tipo !== "" && !modoPresenca) p.set("t", estado.tipo);
    if (estado.uf) p.set("uf", estado.uf);
    if (estado.partido) p.set("p", estado.partido);
    history.replaceState(null, "", `#${p}`);
    if (modoPresenca) return desenharPresenca(idx);
    let serie = null;
    if (estado.tipo !== "") {
      $("#r-resumo").textContent = "Carregando o tipo de gasto…";
      try { serie = await serieDoTipo(estado.tipo); }
      catch (erro) { console.error(erro); if (meu === pedido) $("#r-resumo").textContent = "Não foi possível carregar esse tipo de gasto agora. Tente de novo em instantes."; return; }
      if (meu !== pedido) return;  // outro filtro foi escolhido enquanto este carregava
    }
    desenharGasto(idx, serie);
  }

  function desenharGasto(idx, serieDe) {
    const nomeTipo = serieDe ? $("#r-tipo").selectedOptions[0].textContent.toLowerCase() : "";
    const linhas = deputados.filter(d => (!estado.uf || d.uf === estado.uf) && (!estado.partido || d.p === estado.partido))
      .map(d => {
        const serie = serieDe ? serieDe(d.id) : d.m;
        const v = somar(serie, idx), tudo = serieDe ? somar(d.m, idx) : v;
        const lim = sen ? 0 : limiteAtivo(d, idx, resumo.limites);
        const ativos = serie.filter(Boolean).length;
        const mediaMensal = ativos ? serie.reduce((s, x) => s + (x || 0), 0) / ativos : 0;
        const mesesAtivos = idx.filter(i => serie[i]).length;
        return { d, v, tudo, cota: lim ? v / lim : 0, salto: mediaMensal && mesesAtivos ? v / (mediaMensal * mesesAtivos) : 0 };
      })
      .filter(x => x.v > 0 && (estado.ordem !== "salto" || x.v >= 5000));
    linhas.sort((a, b) => (estado.ordem === "cota" ? b.cota - a.cota : estado.ordem === "salto" ? b.salto - a.salto
      : estado.ordem === "nome" ? a.d.n.localeCompare(b.d.n, "pt-BR") : b.v - a.v));
    const max = Math.max(...linhas.map(x => x.v), 1);
    const total = linhas.reduce((s, x) => s + x.v, 0);
    $("#r-resumo").textContent = `${linhas.length === 1 ? `1 ${sen ? "senador" : "deputado"}` : `${linhas.length.toLocaleString("pt-BR")} ${quem}`} com despesas${nomeTipo ? ` de ${nomeTipo}` : ""} em ${nomePeriodo(estado.periodo)} · ${brlCurto(total)} no total`
      + (idx.some(i => i >= meses.length - resumo.parciais) ? " · inclui meses ainda incompletos" : "");
    $("#r-lista").innerHTML = linhas.slice(0, estado.limite).map((x, k) => {
      const notas = [x.cota ? `${pct(x.cota)} do limite` : "", serieDe && x.tudo > 0 ? `${pct(x.v / x.tudo)} do que o gabinete recebeu` : "",
        x.salto ? `${x.salto.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}× a própria média` : ""].filter(Boolean).join(" · ");
      return `<li><a href="${pagina(x.d)}${sen ? "" : `#per=${estado.periodo}`}">
        <span class="pos">${k + 1}º</span>
        <img class="foto" src="${esc(x.d.f)}" alt="" loading="lazy" decoding="async" width="44" height="44" ${SEM_FOTO}>
        <span><span class="nome">${esc(x.d.n)}</span><br><span class="meta">${meta(x.d)}</span></span>
        <span class="trilho" aria-hidden="true"><span style="width:${(100 * x.v / max).toFixed(1)}%"></span></span>
        <span class="valores">${brl(x.v)}<small>${notas}</small></span>
      </a></li>`;
    }).join("") || `<li class="vazio">Nenhum dos ${quem} tem despesas nesse recorte.</li>`;
    $("#r-mais").hidden = linhas.length <= estado.limite;
  }
  [["#r-periodo", "periodo"], ["#r-ordem", "ordem"], ["#r-tipo", "tipo"], ["#r-uf", "uf"], ["#r-partido", "partido"]].forEach(([s, k]) =>
    $(s).addEventListener("change", e => { estado[k] = e.target.value; estado.limite = 50; desenhar(); }));
  $("#r-mais").addEventListener("click", () => { estado.limite += 50; desenhar(); });
  desenhar();
}

// ------------------------------------------------------------------ página de deputado
async function iniciarDeputado() {
  const dados = JSON.parse($("#dados-deputado").textContent);
  // o cartão de imagem (cartao.js, que só o perfil e a retrospectiva carregam)
  if (dados.cartao && typeof Cartao !== "undefined") Cartao.ligar($("#cartao-botao"), dados.cartao);
  const meses = dados.meses;
  const h = new URLSearchParams(location.hash.slice(1));
  const estado = { periodo: indicesPeriodo(meses, h.get("per")).length ? (h.get("per") || "") : "", categoria: "", busca: "",
    ordem: ["data", "descending"], limite: 100 };
  opcoesPeriodo($("#d-periodo"), meses, estado.periodo);
  // filtra a tabela pelo mês e leva a ela a vista e o foco (o botão que pediu some quando o cartão é redesenhado)
  const verDespesas = valor => {
    definirPeriodo(valor);
    const titulo = $("#despesas h2");
    titulo.tabIndex = -1;
    titulo.focus({ preventScroll: true });
    $("#despesas").scrollIntoView({ behavior: SEM_MOVIMENTO ? "auto" : "smooth" });
  };
  // as despesas com um fornecedor (pelo CNPJ, na busca da tabela), em toda a legislatura: pedido do painel do perfil
  const verFornecedor = doc => {
    definirPeriodo("");
    estado.busca = doc; $("#d-busca").value = doc; estado.limite = 100;
    desenharDespesas();
    const titulo = $("#despesas h2");
    titulo.tabIndex = -1;
    titulo.focus({ preventScroll: true });
    $("#despesas").scrollIntoView({ behavior: SEM_MOVIMENTO ? "auto" : "smooth" });
  };
  // a linha do tempo e o painel (perfil.js); sem ela, ou se ela falhar, o gráfico simples de antes, em que o clique
  // filtra as despesas do mês. Um erro nela não pode parar o resto da página (tabela de despesas, gabinete...)
  let linhaDoTempo = null;
  try {
    linhaDoTempo = window.LinhaDoTempo?.iniciar(dados, { periodo: estado.periodo, aoVerDespesas: verDespesas,
      aoVerFornecedor: verFornecedor }) || null;
  } catch (erro) { console.error(erro); }
  const desenharGrafico = () => linhaDoTempo ? linhaDoTempo.periodo(estado.periodo) : graficoLinha($("#mensal"), meses, dados.valores, {
    altura: 220, limites: dados.limites, parciais: dados.parciais, destaque: estado.periodo ? indicesPeriodo(meses, estado.periodo) : null,
    aoClicar: i => verDespesas(String(meses[i])),
  });
  if (!linhaDoTempo) desenharGrafico();

  const [detalhe, resumo] = await Promise.all([json(`dados/dep/${dados.id}.json`), json("dados/resumo.json")]);
  const linkNota = r => {
    const ano = r[8] || Math.floor(meses[r[0]] / 100);
    if (r[7] === 0) return `https://www.camara.leg.br/cota-parlamentar/documentos/publ/${dados.id}/${ano}/${r[6]}.pdf`;
    if (r[7] === 1) return `https://www.camara.leg.br/cota-parlamentar/nota-fiscal-eletronica?ideDocumentoFiscal=${r[6]}`;
    return null;
  };
  try {
    linhaDoTempo?.detalhe(detalhe, { categorias: resumo.categorias, linkNota, sessoes: resumo.sessoes, presencaAte: resumo.presenca_ate,
      edicao: resumo.edicao });
  } catch (erro) { console.error(erro); }
  resumo.categorias.forEach((c, i) => $("#d-categoria").insertAdjacentHTML("beforeend", `<option value="${i}">${esc(c)}</option>`));

  // gastos por tipo, mês a mês: as cores vêm de resumo.cores, as mesmas da página Gastos; ajustes (-1) ficam de fora
  const porTipo = new Map();
  detalhe.d.forEach(r => {
    const corTipo = resumo.cores?.[r[2]] ?? 0;
    if (corTipo < 0) return;
    const nome = corTipo ? resumo.categorias[r[2]] : "Outros";
    if (!porTipo.has(nome)) porTipo.set(nome, { nome, cor: corTipo, valores: meses.map(() => 0) });
    porTipo.get(nome).valores[r[0]] += r[5];
  });
  const seriesTipo = [...porTipo.values()].filter(s => s.valores.some(Boolean)).sort((a, b) => (a.cor || 99) - (b.cor || 99));
  seriesTipo.forEach(s => { s.valores = s.valores.map(Math.round); });
  if (seriesTipo.length) graficoLinhas($("#mensal-tipos"), meses, seriesTipo, { parciais: dados.parciais });
  else $("#mensal-tipos").innerHTML = `<span class="cat">Nenhuma despesa registrada.</span>`;

  function filtrarDespesas() {
    const idx = new Set(indicesPeriodo(meses, estado.periodo));
    const q = normalizar(estado.busca), qDigitos = estado.busca.replace(/\D/g, "");
    const lista = detalhe.d.filter(r => idx.has(r[0]) && (estado.categoria === "" || r[2] === +estado.categoria) &&
      (!q || normalizar(detalhe.f[r[3]][0]).includes(q) || (qDigitos.length >= 3 && detalhe.f[r[3]][1].replace(/\D/g, "").includes(qDigitos))));
    const [coluna, direcao] = estado.ordem;
    const chave = {
      data: r => r[1] ? +`${r[1].slice(6)}${r[1].slice(3, 5)}${r[1].slice(0, 2)}` : meses[r[0]] * 100,
      tipo: r => normalizar(resumo.categorias[r[2]]),
      fornecedor: r => normalizar(detalhe.f[r[3]][0]),
      numero: r => /^\d+$/.test(r[4]) ? +r[4] : r[4] ? normalizar(r[4]) : null,
      valor: r => r[5],
    }[coluna];
    return lista.map(r => [chave(r), r]).sort((a, b) => comparar(a[0], b[0], direcao)).map(x => x[1]);
  }
  function desenharDespesas() {
    const lista = filtrarDespesas();
    const total = lista.reduce((s, r) => s + r[5], 0);
    $("#d-resumo").textContent = `${lista.length.toLocaleString("pt-BR")} despesa${lista.length === 1 ? "" : "s"} · ${brl2(total)} em ${nomePeriodo(estado.periodo)}`;
    $("#d-tabela").innerHTML = `<tr><th data-chave="data">Data</th><th data-chave="tipo">Tipo de gasto</th><th data-chave="fornecedor">Fornecedor</th>
      <th data-chave="numero">Nº</th><th class="n" data-chave="valor">Valor</th><th class="sem-ordem">Nota</th></tr>` +
      lista.slice(0, estado.limite).map(r => {
        const url = linkNota(r), [nome, doc] = detalhe.f[r[3]];
        return `<tr><td class="mono">${esc(r[1] || nomeMes(meses[r[0]]))}</td><td class="cat">${esc(resumo.categorias[r[2]])}</td>
          <td>${esc(nome)}<br><span class="mono cat">${esc(doc)}</span></td><td class="mono">${esc(r[4])}</td>
          <td class="n">${r[9] ? `<span class="cat">devolução de</span> ${brl2(r[9])}` : brl2(r[5]) + (r[10] ? glosaHTML(...r[10]) : "")}</td><td>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">ver nota</a>` : "—"}</td></tr>`;
      }).join("") + (lista.length ? "" : `<tr><td colspan="6" class="vazio">Nenhuma despesa com esses filtros.</td></tr>`);
    $("#d-glosa").hidden = !lista.slice(0, estado.limite).some(r => r[10]);
    $("#d-tabela").dataset.ordem = estado.ordem.join(":");
    tabelaOrdenavel($("#d-tabela"), (coluna, direcao) => { estado.ordem = [coluna, direcao]; estado.limite = 100; desenharDespesas(); });
    $("#d-mais").hidden = lista.length <= estado.limite;
  }
  let desenharEquipe = () => {};
  function definirPeriodo(valor) {
    estado.periodo = valor; $("#d-periodo").value = valor; estado.limite = 100;
    desenharDespesas(); desenharGrafico(); desenharEquipe();
    // só o #per= muda: as outras chaves (a vista do painel, perfil.js) e o estado do histórico ficam
    const p = new URLSearchParams(location.hash.includes("=") ? location.hash.slice(1) : "");
    if (valor) p.set("per", valor); else p.delete("per");
    history.replaceState(history.state, "", p.toString() ? `#${p}` : location.pathname);
  }
  $("#d-periodo").addEventListener("change", e => definirPeriodo(e.target.value));
  $("#d-categoria").addEventListener("change", e => { estado.categoria = e.target.value; estado.limite = 100; desenharDespesas(); });
  $("#d-busca").addEventListener("input", e => { estado.busca = e.target.value; estado.limite = 100; desenharDespesas(); });
  $("#d-mais").addEventListener("click", () => { estado.limite += 100; desenharDespesas(); });
  $("#d-csv").addEventListener("click", () => baixarCSV(`despesas-${arquivo(dados.nome)}${estado.periodo ? "-" + estado.periodo : ""}.csv`,
    ["Data", "Mês", "Tipo de gasto", "Fornecedor", "CNPJ/CPF", "Número da nota", "Valor reembolsado (R$)", "Valor da nota (R$)",
     "Glosa (R$)", "Link da nota"],
    filtrarDespesas().map(r => [r[1], nomeMes(meses[r[0]]), resumo.categorias[r[2]], ...detalhe.f[r[3]], r[4], r[5],
      r[10] ? r[10][0] : "", r[10] ? r[10][1] : "", linkNota(r) || ""])));
  desenharDespesas();

  // cota e verba de gabinete mês a mês (mais recente primeiro)
  const verba = Object.fromEntries(detalhe.v.map(([i, disp, gasto]) => [i, [disp, gasto]]));
  const linhasMes = meses.map((m, i) => i).filter(i => dados.valores[i] || verba[i]).reverse();
  // a equipe muda todo mês: um vínculo conta no mês se começou até o último dia e não saiu antes do primeiro
  const inicioMes = m => `${Math.floor(m / 100)}-${String(m % 100).padStart(2, "0")}-01`;
  const fimMes = m => `${Math.floor(m / 100)}-${String(m % 100).padStart(2, "0")}-31`;
  const ativoEntre = (p, de, ate) => (p[3] || "") <= ate && (!p[4] || p[4] >= de);
  const equipe = EQUIPE ? detalhe.e || [] : [];
  const equipeNoMes = i => equipe.filter(p => ativoEntre(p, inicioMes(meses[i]), fimMes(meses[i]))).length;
  const dataBR = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";

  $("#tabela-mensal").innerHTML = `<tr><th>Mês</th><th class="n">Cota gasta</th><th class="n">Uso</th>${EQUIPE ? `<th class="n">Equipe</th>` : ""}<th class="n">Verba gasta</th><th class="n">Disponível</th></tr>` +
    linhasMes.map(i => {
      const uso = dados.limites[i] ? dados.valores[i] / dados.limites[i] : null;
      const [disp, gastoV] = verba[i] || [];
      return `<tr><td data-v="${meses[i]}"><a href="#despesas" data-mes="${meses[i]}">${nomeMes(meses[i])}</a></td><td class="n">${brl(dados.valores[i])}</td>
        <td class="n"><span class="uso${uso > 1.5 ? " alto" : ""}">${uso === null ? "—" : pct(uso)}</span></td>
        ${EQUIPE ? `<td class="n">${equipe.length ? equipeNoMes(i) : "—"}</td>` : ""}
        <td class="n">${gastoV === undefined ? "—" : brl(gastoV)}</td><td class="n">${disp === undefined ? "—" : brl(disp)}</td></tr>`;
    }).join("");
  $("#tabela-mensal").addEventListener("click", e => { const a = e.target.closest("[data-mes]"); if (a) definirPeriodo(a.dataset.mes); });
  tabelaOrdenavel($("#tabela-mensal"));

  desenharEquipe = () => {
    if (!$("#tabela-equipe")) return;  // o site sem a equipe dos gabinetes
    if (!equipe.length) {
      $("#equipe-resumo").textContent = "A Câmara não informa funcionários para este deputado.";
      $("#tabela-equipe").innerHTML = "";
      return;
    }
    const idx = indicesPeriodo(meses, estado.periodo);
    const de = estado.periodo ? inicioMes(meses[idx[0]]) : "0000-00-00", ate = estado.periodo ? fimMes(meses[idx[idx.length - 1]]) : "9999-12-31";
    const lista = equipe.filter(p => ativoEntre(p, de, ate));
    const pessoas = new Set(lista.map(p => p[0])).size;
    $("#equipe-resumo").textContent = estado.periodo
      ? `${pessoas} pessoa(s) passaram pelo gabinete em ${nomePeriodo(estado.periodo)} (${lista.length} vínculos; trocas de nível contam como vínculos novos).`
      : `${pessoas} pessoas e ${lista.length} vínculos registrados pela Câmara; ${lista.filter(p => !p[4]).length} sem data de saída. Escolha um mês para ver a equipe daquele mês.`;
    $("#tabela-equipe").innerHTML = `<tr><th>Nome</th><th>Função</th><th>Nível</th><th>Período</th></tr>` +
      lista.map(p => `<tr><td>${esc(p[0])}</td><td class="cat">${esc(p[1])}</td><td class="mono">${esc(p[2])}</td>
        <td class="mono cat" data-v="${(p[3] || "").replace(/-/g, "")}">${p[4] ? `${dataBR(p[3])} a ${dataBR(p[4])}` : `desde ${dataBR(p[3])}`}</td></tr>`).join("");
    tabelaOrdenavel($("#tabela-equipe"));
  };
  desenharEquipe();

  marcarSecaoAtual();

  const area = $("#mapa-gastos");
  if (!area || !Object.keys(dados.ufs).length) return;
  const svg = await carregarMapa(area);
  const faixa = faixas(dados.ufs);
  svg.querySelectorAll(".uf").forEach(p => {
    const v = dados.ufs[p.dataset.uf];
    p.dataset.n = v ? faixa(v) : "vazio";
    p.setAttribute("aria-label", `${NOMES_UF[p.dataset.uf]}: ${v ? brl(v) : "sem gastos"}`);
    p.removeAttribute("role"); p.removeAttribute("aria-pressed"); p.removeAttribute("tabindex");
  });
  dicaNoMapa(area, svg, uf => dados.ufs[uf] ? `<strong>${NOMES_UF[uf]}</strong>${brl(dados.ufs[uf])} em fornecedores sediados aqui` : "");
}

function marcarSecaoAtual() {
  const links = [...document.querySelectorAll(".subnav a")];
  const secoes = links.map(a => document.getElementById(a.hash.slice(1))).filter(Boolean);
  if (!secoes.length || !("IntersectionObserver" in window)) return;
  const visiveis = new Set();
  const observador = new IntersectionObserver(entradas => {
    entradas.forEach(e => e.isIntersecting ? visiveis.add(e.target.id) : visiveis.delete(e.target.id));
    const atual = secoes.find(s => visiveis.has(s.id));
    if (!atual) return;
    links.forEach(a => a.hash === `#${atual.id}` ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current"));
    // no celular o menu é mais largo que a tela: rola de lado até a seção acesa, para ela não ficar escondida
    const a = links.find(l => l.hash === `#${atual.id}`), nav = a.parentElement;
    if (a.offsetLeft < nav.scrollLeft || a.offsetLeft + a.offsetWidth > nav.scrollLeft + nav.clientWidth)
      nav.scrollTo({ left: a.offsetLeft - 24, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, { rootMargin: "-140px 0px -55% 0px" });
  secoes.forEach(s => observador.observe(s));
}

// ------------------------------------------------------------------ página de alertas
async function iniciarAlertas() {
  const [meta, resumo] = await Promise.all([json("dados/alertas-meta.json"), json("dados/resumo.json")]);
  const porGravidade = {};
  const carregar = async g => porGravidade[g] ??= await json(`dados/alertas-${g}.json`);
  const CAMPOS = [["#f-grav", "gravidade", "g"], ["#f-uf", "uf", "uf"], ["#f-busca", "busca", "q"],
    ["#f-periodo", "periodo", "per"], ["#f-revisao", "revisao", "rev"]];
  const estado = { grupo: "", regra: "", gravidade: "3", uf: "", busca: "", periodo: "", revisao: "", limite: 50 };
  const h = new URLSearchParams(location.hash.slice(1));
  CAMPOS.forEach(([, k, curto]) => { if (h.has(curto)) estado[k] = h.get(curto); });
  const grupoDe = Object.fromEntries(meta.regras.map(r => [r.codigo, r.grupo]));
  if (h.has("r") && grupoDe[h.get("r")]) { estado.regra = h.get("r"); estado.grupo = grupoDe[estado.regra]; }
  else if (meta.grupos.some(g => g.chave === h.get("t"))) estado.grupo = h.get("t");
  Object.keys(NOMES_UF).sort().forEach(uf => $("#f-uf").insertAdjacentHTML("beforeend", `<option value="${uf}">${NOMES_UF[uf]}</option>`));
  opcoesPeriodo($("#f-periodo"), resumo.meses);
  CAMPOS.forEach(([s, k]) => { $(s).value = estado[k]; estado[k] = $(s).value; });
  const titulo = Object.fromEntries(meta.regras.map(r => [r.codigo, r.titulo]));
  const GRAV = { 3: "Alta", 2: "Média", 1: "Baixa" };
  let lista = [];

  async function filtrar() {
    const niveis = estado.gravidade ? [3, 2, 1].filter(g => g >= +estado.gravidade) : [3, 2, 1];
    const todos = (await Promise.all(niveis.map(carregar))).flat();
    const q = normalizar(estado.busca);
    const noPeriodo = new Set(indicesPeriodo(resumo.meses, estado.periodo));
    return todos.filter(a => {
      const d = meta.deputados[a.p];
      return (!estado.uf || d.uf === estado.uf) &&
        (!estado.periodo || (a.m !== null && noPeriodo.has(a.m))) &&
        (!estado.revisao || (estado.revisao === "sim") === !!a.s) &&
        (!q || normalizar(`${a.t} ${d.nome} ${d.partido}`).includes(q));
    });
  }

  async function desenhar() {
    $("#contagem").textContent = "Carregando…";
    const semTipo = await filtrar();
    desenharTipos(semTipo);
    lista = semTipo.filter(a => estado.regra ? a.r === estado.regra : !estado.grupo || grupoDe[a.r] === estado.grupo);
    const revisados = lista.filter(a => a.s).length;
    $("#contagem").textContent = `${lista.length.toLocaleString("pt-BR")} alerta${lista.length === 1 ? "" : "s"}` +
      (estado.periodo ? ` em ${nomePeriodo(estado.periodo)}` : "") + (revisados ? ` · ${revisados} revisado${revisados === 1 ? "" : "s"}` : "");
    $("#lista-alertas").innerHTML = lista.slice(0, estado.limite).map(a => {
      const d = meta.deputados[a.p];
      const notas = a.n.map(n => `<li>${esc(n[1])} · nota ${esc(n[0] || "s/n")} · <span class="num">${brl2(n[2])}</span>${n[5] > 0 ? ` <span class="cat">(nota ${brl2(n[4])}, glosa −${brl2(n[5])})</span>` : ""}${n[3] ? ` · <a href="${esc(n[3])}" target="_blank" rel="noopener">ver nota</a>` : ""}</li>`).join("");
      const quem = [`<a href="deputado/${a.p}.html">${esc(d.nome)}</a> (${esc(d.partido)}/${esc(d.uf)})`];
      if (a.m !== null) quem.push(`<span class="mono">${nomeMes(resumo.meses[a.m])}</span>`);
      if (a.f) quem.push(`<a href="fornecedor/${a.f}.html">ver empresa</a>`);
      if (!a.s) quem.push(`<span class="status">revisão pendente</span>`);
      return `<article class="alerta g${a.g}"><div class="cab"><span class="pill g${a.g}">${GRAV[a.g]}</span><h3><a href="alerta/${a.c}.html">${esc(titulo[a.r])}</a></h3>${a.vl > 0 ? `<span class="valor-alerta"><b class="num">${brlCurto(a.vl)}</b> envolvidos</span>` : ""}</div>
        <p class="meta">${quem.join(" · ")}</p><p class="desc">${esc(a.t)}</p>
        ${a.s ? `<p class="revisao ${esc(a.s)}"><span class="rv"><strong>${esc(a.rl || a.s)}.</strong> ${a.va
          // revisão herdada na troca de chave: feita numa versão anterior (a revisada), que tem página própria
          ? `Revisão feita numa versão anterior deste alerta (<a href="alerta/${esc(a.va[0])}.html">ver a versão revisada</a>), em ${esc(a.va[1])}${a.v ? `: ${esc(a.v)}` : "."}`
          : esc(a.v || "")}</span></p>` : ""}
        ${notas ? `<details><summary>Notas envolvidas</summary><ul>${notas}</ul></details>` : ""}</article>`;
    }).join("") || `<p class="vazio">Nenhum alerta com esses filtros. Escolha outra gravidade ou outro período.</p>`;
    marcarCortes($("#lista-alertas"));
    const resto = lista.length - estado.limite;
    $("#mais").hidden = resto <= 0;
    $("#mais").textContent = `Mostrar mais ${Math.min(50, resto)} de ${resto} restantes`;
    const p = new URLSearchParams();
    if (estado.regra) p.set("r", estado.regra); else if (estado.grupo) p.set("t", estado.grupo);
    CAMPOS.forEach(([, k, curto]) => { if (estado[k] !== (k === "gravidade" ? "3" : "")) p.set(curto, estado[k]); });
    history.replaceState(null, "", p.toString() ? `#${p}` : location.pathname);
  }
  // quanto confiar em cada tipo: resultado das revisões já feitas
  const acerto = r => !r.revisados ? "Nenhum alerta deste tipo revisado ainda"
    : r.revisados < 5 ? `${r.revisados} revisado(s), ${r.confirmados} confirmado(s): poucas revisões ainda`
    : `${r.revisados} revisados, ${r.confirmados} confirmados (${Math.round(100 * r.confirmados / r.revisados)}%)`;
  // alertas da família abaixo da gravidade escolhida (0 sem filtro de gravidade)
  const abaixoDoFiltro = g => !estado.gravidade ? 0 :
    Object.entries(g.n || {}).reduce((s, [v, n]) => s + (+v < +estado.gravidade ? n : 0), 0);
  // botões de tipo de achado: família primeiro, depois o tipo dentro dela
  function desenharTipos(semTipo) {
    const porRegra = {}, porGrupo = {};
    semTipo.forEach(a => { porRegra[a.r] = (porRegra[a.r] || 0) + 1; porGrupo[grupoDe[a.r]] = (porGrupo[grupoDe[a.r]] || 0) + 1; });
    const botao = (classe, dados, ativo, rotulo, n, titulo = "") => `<button type="button" class="${classe}" ${dados}
      aria-pressed="${ativo}"${titulo ? ` title="${esc(titulo)}"` : ""}${n || ativo ? "" : " disabled"}>${esc(rotulo)}<span class="num">${n.toLocaleString("pt-BR")}</span></button>`;
    $("#tipos-grupos").innerHTML = botao("tipo-grupo", `data-grupo=""`, !estado.grupo, "Todos", semTipo.length) +
      meta.grupos.map(g => {
        const n = porGrupo[g.chave] || 0, abaixo = n ? 0 : abaixoDoFiltro(g);
        // família sem alerta na gravidade escolhida, mas com alertas mais leves: continua clicável e diz quantos tem
        return abaixo ? botao("tipo-grupo fora-do-filtro", `data-grupo="${g.chave}"`, false, g.nome, abaixo,
          `${abaixo.toLocaleString("pt-BR")} de gravidade ${g.n[2] ? "média" : "baixa"}${g.n[2] && g.n[1] ? " ou baixa" : ""}: ao escolher, a lista passa a mostrá-los`)
          : botao("tipo-grupo", `data-grupo="${g.chave}"`, estado.grupo === g.chave, g.nome, n, g.descricao);
      }).join("");
    const regras = meta.regras.filter(r => r.grupo === estado.grupo && (porRegra[r.codigo] || r.codigo === estado.regra))
      .sort((a, b) => (porRegra[b.codigo] || 0) - (porRegra[a.codigo] || 0));
    $("#tipos-regras").hidden = !estado.grupo;
    $("#tipos-regras").innerHTML = !estado.grupo ? "" :
      botao("chip", `data-regra=""`, !estado.regra, `Todos de ${meta.grupos.find(g => g.chave === estado.grupo).nome.toLowerCase()}`, porGrupo[estado.grupo] || 0) +
      regras.map(r => botao("chip", `data-regra="${r.codigo}"`, estado.regra === r.codigo, r.titulo, porRegra[r.codigo] || 0, acerto(r))).join("") +
      (regras.length ? "" : `<span class="tipos-vazio">Nenhum achado desta família com os filtros atuais.</span>`);
  }
  $("#tipos-grupos").addEventListener("click", e => {
    const b = e.target.closest("[data-grupo]"); if (!b) return;
    if (b.classList.contains("fora-do-filtro")) {  // abre a gravidade mais alta em que a família tem alertas
      const g = meta.grupos.find(x => x.chave === b.dataset.grupo);
      estado.gravidade = g.n[2] && +estado.gravidade > 2 ? "2" : "";
      $("#f-grav").value = estado.gravidade;
      estado.grupo = g.chave;
    } else estado.grupo = estado.grupo === b.dataset.grupo ? "" : b.dataset.grupo;
    estado.regra = ""; estado.limite = 50; desenhar();
  });
  $("#tipos-regras").addEventListener("click", e => {
    const b = e.target.closest("[data-regra]"); if (!b) return;
    estado.regra = estado.regra === b.dataset.regra ? "" : b.dataset.regra; estado.limite = 50; desenhar();
  });
  CAMPOS.forEach(([s, k]) => $(s).addEventListener("input", e => { estado[k] = e.target.value; estado.limite = 50; desenhar(); }));
  $("#mais").addEventListener("click", () => { estado.limite += 50; desenhar(); });
  $("#lista-alertas").addEventListener("click", e => {
    const b = e.target.closest(".ler-tudo"); if (!b) return;
    const aberto = b._alvo.classList.toggle("cortavel") === false;
    b.setAttribute("aria-expanded", aberto);
    b.textContent = aberto ? "Ler menos" : "Ler tudo";
  });
  $("#f-csv").addEventListener("click", () => baixarCSV("alertas-cota-parlamentar.csv",
    ["Gravidade", "Tipo de alerta", "Deputado", "Partido", "UF", "Mês", "Descrição", "Revisão", "Notas"],
    lista.map(a => {
      const d = meta.deputados[a.p];
      return [GRAV[a.g], titulo[a.r], d.nome, d.partido, d.uf, a.m !== null ? nomeMes(resumo.meses[a.m]) : "", a.t,
        a.s ? `${a.rl || a.s}. ${a.v || ""}` : "pendente", a.n.map(n => n[3]).filter(Boolean).join(" ")];
    })));
  desenhar();
}

// lista de Alertas no celular: descrição e revisão longas ficam em poucas linhas (CSS, .cortavel) e ganham "Ler tudo";
// onde o texto cabe (ou no computador, sem corte) a classe sai e não há botão. Primeiro marca tudo, depois mede, depois
// escreve: uma medida por texto, sem recalcular a página a cada alerta. Na revisão o corte vai no texto de dentro
// (.rv): na caixa com margem interna, a linha seguinte ao corte apareceria pela metade
function marcarCortes(raiz) {
  const textos = [...raiz.querySelectorAll(".alerta > .desc, .alerta > .revisao > .rv")];
  textos.forEach(t => t.classList.add("cortavel"));
  const cortados = textos.map(t => t.scrollHeight > t.clientHeight + 2);
  textos.forEach((t, i) => {
    if (!cortados[i]) { t.classList.remove("cortavel"); return; }
    const b = Object.assign(document.createElement("button"), { type: "button", className: "ler-tudo", textContent: "Ler tudo", _alvo: t });
    b.setAttribute("aria-expanded", "false");
    t.closest("p").after(b);
  });
}

// o botão diz o que aconteceu por 2,5 s e volta ao rótulo; o leitor de tela ouve o mesmo numa região viva (dentro do
// <dialog> aberto, quando o botão está nele: o resto da página fica inerte atrás do painel)
function avisarNoBotao(b, texto) {
  b.dataset.rotulo ??= b.textContent;
  b.textContent = texto;
  const onde = b.closest("dialog") || document.body;
  let viva = onde.querySelector(":scope > .aviso-botao");
  if (!viva) {
    viva = Object.assign(document.createElement("p"), { className: "vh aviso-botao" });
    viva.setAttribute("aria-live", "polite");
    onde.append(viva);
  }
  viva.textContent = "";
  setTimeout(() => { viva.textContent = texto; }, 50);
  clearTimeout(b._volta);
  b._volta = setTimeout(() => { if (b.isConnected) b.textContent = b.dataset.rotulo; }, 2500);
}

document.addEventListener("click", async e => {
  const b = e.target.closest("[data-copiar]"); if (!b) return;
  const alvo = document.querySelector(b.dataset.copiar), texto = alvo?.textContent.trim() || "";
  try { await navigator.clipboard.writeText(texto); avisarNoBotao(b, b.dataset.copiado || "Citação copiada"); }
  catch { getSelection().selectAllChildren(alvo); avisarNoBotao(b, "Selecionado: use Ctrl+C"); }
});

// compartilhar (E8): a folha do sistema quando o navegador tem; senão copia o texto e o link. Usado também pelo painel
// do perfil (perfil.js), que põe o mesmo data-compartilhar nos botões dele. Com a folha aberta, outro toque não faz
// nada (o navegador recusaria com InvalidStateError, e o texto iria para a área de transferência sem ninguém pedir)
async function compartilhar(b, texto, url) {
  if (b._ocupado) return;
  b._ocupado = true;
  try {
    if (navigator.share) {
      try { await navigator.share({ title: document.title, text: texto, url }); return; }
      catch (erro) { if (erro.name !== "NotAllowedError" && erro.name !== "TypeError") return; }  // cancelado: nada
    }
    try { await navigator.clipboard.writeText(`${texto} ${url}`); avisarNoBotao(b, "Texto e link copiados"); }
    catch { avisarNoBotao(b, "Não deu para copiar: copie o endereço da página"); }
  } finally { b._ocupado = false; }
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-compartilhar]");
  if (b) compartilhar(b, b.dataset.compartilhar, b.dataset.url || location.href);
  else if (e.target.closest("[data-imprimir]")) print();
});
// sem JS esses botões não fazem nada: nascem escondidos
document.querySelectorAll("[data-copiar], [data-compartilhar], [data-imprimir]").forEach(b => { b.hidden = false; });

// ------------------------------------------------------------------ comparar gabinetes (2 a 5, em colunas)
// Só números dos dados públicos, na ordem em que a pessoa escolheu: sem nota, sem "melhor" e "pior". A mesma tela nas
// duas casas: comparar.html (casa "d") e comparar-senadores.html (casa "s"). O maior tipo de gasto vem do arquivo de
// cada deputado (dados/dep/<id>.json), baixado só para quem está na comparação; no Senado, de dados/senado-tipos.json.
// O Senado não tem limite da cota nem alertas aqui, e a presença só entra com a chave ligada.
async function iniciarComparar(casa = "d") {
  const sen = casa === "s", comPresenca = !sen && PRESENCA, comAlertas = !sen && ALERTAS;
  const [brutos, resumo, presenca] = await Promise.all([json(sen ? "dados/senadores.json" : "dados/deputados.json"),
    json("dados/resumo.json"), comPresenca ? json("dados/presenca.json").catch(() => ({})) : {}]);
  const deputados = sen ? brutos.map(s => ({ id: s.c, n: s.n, p: s.p, uf: s.uf, f: s.f, x: !!s.x, m: s.m || [], b: normalizar(s.n), sup: s.s })) : brutos;
  const meses = sen ? (resumo.meses_senado || resumo.meses) : resumo.meses;
  const um = sen ? "senador" : "deputado", varios = sen ? "senadores" : "deputados";
  const pagina = d => sen ? `senador/${d.id}.html` : `deputado/${d.id}.html`;
  const porId = Object.fromEntries(deputados.map(d => [String(d.id), d]));
  const h = new URLSearchParams(location.hash.slice(1));
  const estado = { ids: (h.get("ids") || "").split(",").filter(id => porId[id]).slice(0, 5), periodo: "" };
  if (h.get("per") && indicesPeriodo(meses, h.get("per")).length) estado.periodo = h.get("per");
  opcoesPeriodo($("#c-periodo"), meses, estado.periodo);
  const arquivos = {};
  const arquivo = id => arquivos[id] ??= json(sen ? "dados/senado-tipos.json" : `dados/dep/${id}.json`).catch(() => null);
  const busca = $("#c-busca"), lista = $("#c-sugestoes");
  let sugestoes = [], ativa = -1;

  function salvar() {
    const p = new URLSearchParams();
    if (estado.ids.length) p.set("ids", estado.ids.join(","));
    if (estado.periodo) p.set("per", estado.periodo);
    history.replaceState(null, "", p.toString() ? `#${p}` : location.pathname);
  }
  function fecharSugestoes() { lista.hidden = true; busca.setAttribute("aria-expanded", "false"); busca.removeAttribute("aria-activedescendant"); ativa = -1; }
  function mostrarSugestoes() {
    const q = normalizar(busca.value.trim());
    sugestoes = q.length < 2 ? [] : deputados.filter(d => d.b.includes(q) && !estado.ids.includes(String(d.id))).slice(0, 8);
    lista.innerHTML = sugestoes.map((d, i) => `<li role="option" id="c-op-${i}" data-id="${d.id}" aria-selected="${i === ativa}">
      <img class="foto" src="${esc(d.f)}" alt="" width="32" height="32" loading="lazy" ${SEM_FOTO}>
      <span><b>${esc(d.n)}</b><small>${esc(d.p)} · ${esc(d.uf)}${d.x ? "" : " · fora do exercício"}</small></span></li>`).join("");
    lista.hidden = !sugestoes.length || estado.ids.length >= 5;
    busca.setAttribute("aria-expanded", String(!lista.hidden));
  }
  function adicionar(id) {
    if (estado.ids.length >= 5 || estado.ids.includes(String(id))) return;
    estado.ids.push(String(id)); busca.value = ""; fecharSugestoes(); desenhar(); busca.focus();
  }
  busca.addEventListener("input", () => { ativa = -1; mostrarSugestoes(); });
  busca.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!sugestoes.length) return;
      e.preventDefault();
      ativa = (ativa + (e.key === "ArrowDown" ? 1 : -1) + sugestoes.length) % sugestoes.length;
      mostrarSugestoes(); busca.setAttribute("aria-activedescendant", `c-op-${ativa}`);
    } else if (e.key === "Enter" && sugestoes.length) { e.preventDefault(); adicionar(sugestoes[Math.max(ativa, 0)].id); }
    else if (e.key === "Escape") fecharSugestoes();
  });
  lista.addEventListener("click", e => { const li = e.target.closest("[data-id]"); if (li) adicionar(li.dataset.id); });
  document.addEventListener("click", e => { if (!e.target.closest(".busca-comparar")) fecharSugestoes(); });
  $("#c-escolhidos").addEventListener("click", e => {
    const b = e.target.closest("[data-tirar]"); if (!b) return;
    estado.ids = estado.ids.filter(id => id !== b.dataset.tirar); desenhar(); busca.focus();
  });
  $("#c-periodo").addEventListener("change", e => { estado.periodo = e.target.value; desenhar(); });

  async function desenhar() {
    salvar();
    const idx = indicesPeriodo(meses, estado.periodo), conjunto = new Set(idx);
    const escolhidos = estado.ids.map(id => porId[id]);
    $("#c-escolhidos").innerHTML = escolhidos.map(d => `<li><img class="foto" src="${esc(d.f)}" alt="" width="28" height="28" ${SEM_FOTO}>
      <span>${esc(d.n)} <small>${esc(d.p)}/${esc(d.uf)}</small></span>
      <button type="button" data-tirar="${d.id}" aria-label="Tirar ${esc(d.n)} da comparação">×</button></li>`).join("");
    busca.disabled = escolhidos.length >= 5;
    busca.placeholder = escolhidos.length >= 5 ? "Já são cinco: tire alguém para trocar" : `Nome do ${um}`;
    $("#c-resumo").textContent = escolhidos.length < 2
      ? `${escolhidos.length ? `Escolha mais um ${um}` : `Escolha dois ${varios}`} para começar a comparação.`
      : `${escolhidos.length} ${varios} em ${nomePeriodo(estado.periodo)}.`;
    $("#c-quadro").hidden = escolhidos.length < 2;
    const nota = $("#c-nota");  // a nota fala dos alertas e da presença: sem os dois, o HTML vem sem ela
    if (nota) nota.hidden = escolhidos.length < 2;
    if (escolhidos.length < 2) return;
    const dados = escolhidos.map(d => {
      const ativos = idx.filter(i => d.m[i] > 0);
      const v = somar(d.m, idx), lim = sen ? 0 : limiteAtivo(d, idx, resumo.limites), a = comAlertas ? contarAlertas(d, idx, !estado.periodo) : null;
      const p = { dias: 0, pres: 0, faltas: 0 };
      (presenca[d.id] || []).forEach(([i, dias, pres, faltas]) => { if (conjunto.has(i)) { p.dias += dias; p.pres += pres; p.faltas += faltas; } });
      const maior = ativos.reduce((m, i) => d.m[i] > (d.m[m] || 0) ? i : m, ativos[0]);
      return { d, v, media: ativos.length ? v / ativos.length : 0, meses: ativos.length, lim, a, p, maior };
    });
    const linha = (rotulo, f) => `<tr><th scope="row">${rotulo}</th>${dados.map(x => `<td>${f(x)}</td>`).join("")}</tr>`;
    const tipo = x => `<span data-tipo="${x.d.id}" class="cat">carregando…</span>`;
    $("#c-tabela").innerHTML = `<tr><td></td>${dados.map(x => `<th scope="col"><a href="${pagina(x.d)}">
        <img class="foto" src="${esc(x.d.f)}" alt="" width="48" height="48" ${SEM_FOTO}><span>${esc(x.d.n)}</span></a>
        <small>${esc(x.d.p)} · ${esc(x.d.uf)}${sen ? (x.d.sup ? ` · ${esc(x.d.sup)}` : "") : condicao(x.d)}</small></th>`).join("")}</tr>` +
      linha("Reembolsado da cota", x => `<b class="num">${brl(x.v)}</b>`) +
      linha("Média por mês com despesa", x => x.meses ? `${brl(x.media)}<small>${x.meses} ${x.meses === 1 ? "mês" : "meses"}</small>` : "—") +
      (sen ? "" : linha("Uso do limite da cota", x => x.lim ? pct(x.v / x.lim) : "—")) +
      linha("Maior tipo de gasto", tipo) +
      linha("Mês mais caro", x => x.meses ? `${nomeMesLongo(meses[x.maior])}<small>${brl(x.d.m[x.maior])}</small>` : "—") +
      (comPresenca ? linha("Presença no Plenário", x => x.p.dias ? `${pct(x.p.pres / x.p.dias)}<small>${x.p.pres} de ${x.p.dias} dias de sessão</small>` : "—") +
        linha("Faltas sem justificativa", x => x.p.dias ? `${x.p.faltas}` : "—") : "") +
      (comAlertas ? linha("Alertas confirmados", x => `<b class="num">${x.a.k}</b>`) +
        linha("Alertas apontados (altos e médios)", x => `${x.a.g3 + x.a.g2}<small>${x.a.g3} altos · ${x.a.g2} médios</small>`) : "");
    for (const x of dados) {
      const dep = await arquivo(x.d.id), alvo = document.querySelector(`[data-tipo="${x.d.id}"]`);
      if (!alvo) continue;
      if (!dep) { alvo.textContent = "não deu para carregar"; continue; }
      const somas = {};
      // Câmara: as despesas do deputado (mês, data, tipo, ..., valor); Senado: o valor de cada tipo em cada mês
      if (sen) Object.entries(dep.v[x.d.id] || {}).forEach(([t, serie]) => { const s = somar(serie, idx); if (s) somas[t] = s; });
      else dep.d.forEach(r => { if (conjunto.has(r[0])) somas[r[2]] = (somas[r[2]] || 0) + r[5]; });
      const [cat, v] = Object.entries(somas).sort((a, b) => b[1] - a[1])[0] || [];
      alvo.className = "";
      alvo.innerHTML = cat === undefined ? "—" : `${esc(sen ? dep.t[cat] : resumo.categorias[cat])}<small>${brl(v)} · ${x.v ? pct(v / x.v) : "—"} do total</small>`;
    }
  }
  desenhar();
}

// ------------------------------------------------------------------ o voto da sua cidade (votos por município)
// municipios.json: {ano, m: [[uf, nome, código TSE]]}; votos/<uf>.json: {código: [votos nominais do cargo, [[id, votos]]]},
// baixado só quando a pessoa escolhe a cidade. A cidade vem de ?c= (formulário da página inicial) ou de #m=<código>.
// Com dados do Senado (a seção #m-senado existe), a cidade mostra também os senadores em exercício do estado dela,
// de dados/senadores.json ({c: código, n: nome, p: partido, uf, x: em exercício, t: total, f: foto, s: suplência});
// se o arquivo falhar, a página segue só com os deputados.
async function iniciarCidade() {
  const [indice, deputados, senadores] = await Promise.all([json("dados/municipios.json"), json("dados/deputados.json"),
    $("#m-senado") ? json("dados/senadores.json").catch(() => []) : []]);
  const porId = Object.fromEntries(deputados.map(d => [d.id, d]));
  const cidades = indice.m.map(([uf, nome, cod]) => ({ uf, nome, cod, b: normalizar(`${nome} ${uf}`) }));
  const busca = $("#m-busca"), lista = $("#m-sugestoes");
  let sugestoes = [], ativa = -1;
  $("#m-resumo").textContent = `${cidades.length.toLocaleString("pt-BR")} cidades. Digite pelo menos três letras.`;

  const procurar = texto => {
    const q = normalizar(texto.trim());
    if (q.length < 3) return [];
    const exatas = cidades.filter(c => normalizar(c.nome) === q);
    return [...exatas, ...cidades.filter(c => c.b.includes(q) && !exatas.includes(c))].slice(0, 8);
  };
  function fechar() { lista.hidden = true; busca.setAttribute("aria-expanded", "false"); busca.removeAttribute("aria-activedescendant"); ativa = -1; }
  function mostrar() {
    sugestoes = procurar(busca.value);
    lista.innerHTML = sugestoes.map((c, i) => `<li role="option" id="m-op-${i}" data-cod="${c.cod}" aria-selected="${i === ativa}">
      <span><b>${esc(c.nome)}</b><small>${NOMES_UF[c.uf] || c.uf}</small></span></li>`).join("");
    lista.hidden = !sugestoes.length;
    busca.setAttribute("aria-expanded", String(!lista.hidden));
  }
  async function escolher(cidade, rolar = true) {
    fechar();
    busca.value = `${cidade.nome} (${cidade.uf})`;
    history.replaceState(null, "", `${location.pathname}#m=${cidade.cod}`);
    $("#m-resumo").textContent = "Carregando os votos…";
    const votos = await json(`dados/votos/${cidade.uf.toLowerCase()}.json`);
    const [total, lista] = votos[cidade.cod] || [0, []];
    const bancada = deputados.filter(d => d.uf === cidade.uf && d.x).length;
    const mostrados = lista.filter(([id]) => porId[id]).slice(0, 10);
    $("#m-titulo").textContent = `${cidade.nome} (${cidade.uf})`;
    const estado = comArtigo(cidade.uf);
    $("#m-sub").textContent = `${estado[0].toUpperCase()}${estado.slice(1)} tem ${bancada} deputados federais em exercício. ` +
      (mostrados.length ? `Os ${mostrados.length === 1 ? "único que recebeu" : `${mostrados.length} que mais receberam`} votos aqui em ${indice.ano}, entre os que exerceram mandato nesta legislatura:`
        : `Nenhum dos deputados desta legislatura recebeu votos aqui em ${indice.ano}.`);
    $("#m-estado").href = `estado/${cidade.uf.toLowerCase()}.html`;
    $("#m-lista").innerHTML = mostrados.map(([id, n]) => {
      const d = porId[id], a = contarAlertas(d, [], true);
      return `<li><a class="linha" href="deputado/${d.id}.html">
        <img class="foto" src="${esc(d.f)}" alt="" loading="lazy" decoding="async" width="44" height="44" ${SEM_FOTO}>
        <span><span class="nome">${esc(d.n)}</span><br><span class="meta">${esc(d.p)} · ${esc(d.uf)}${condicao(d)}${d.x || d.c === "a" ? "" : " · fora do exercício"}</span>
          <span class="fatia">${n.toLocaleString("pt-BR")} votos aqui${total ? ` · ${(100 * n / total).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% dos votos para deputado federal` : ""}</span></span>
        <span class="direita"><span class="total">${brl(d.t)}</span>${pills(a)}</span></a></li>`;
    }).join("") || `<li class="vazio">Sem votos registrados para os deputados desta legislatura.</li>`;
    $("#m-resultado").hidden = false;
    const doEstado = senadores.filter(s => s.uf === cidade.uf && s.x);
    if ($("#m-senado")) {
      $("#m-senado").hidden = !doEstado.length;
      $("#m-sen-titulo").textContent = `Senadores ${ARTIGO_UF[cidade.uf] ? `d${ARTIGO_UF[cidade.uf]}` : "de"} ${NOMES_UF[cidade.uf]}`;
      $("#m-sen-todos").href = `senadores.html#per=&uf=${cidade.uf}`;
      $("#m-sen-lista").innerHTML = doEstado.map(s => `<li><a class="linha" href="senador/${s.c}.html">
        <img class="foto" src="${esc(s.f)}" alt="" loading="lazy" decoding="async" width="42" height="56" ${SEM_FOTO}>
        <span><span class="nome">${esc(s.n)}</span><br><span class="meta">${esc([s.p, s.uf, s.s].filter(Boolean).join(" · "))}</span></span>
        <span class="direita"><span class="total">${brl(s.t)}</span></span></a></li>`).join("");
    }
    $("#m-resumo").textContent = `Mostrando ${cidade.nome} (${cidade.uf}).`;
    if (rolar) $("#m-resultado").scrollIntoView({ behavior: SEM_MOVIMENTO ? "auto" : "smooth", block: "start" });
  }
  busca.addEventListener("input", () => { ativa = -1; mostrar(); });
  busca.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!sugestoes.length) return;
      e.preventDefault();
      ativa = (ativa + (e.key === "ArrowDown" ? 1 : -1) + sugestoes.length) % sugestoes.length;
      mostrar(); busca.setAttribute("aria-activedescendant", `m-op-${ativa}`);
    } else if (e.key === "Enter") { e.preventDefault(); const s = sugestoes[Math.max(ativa, 0)] || procurar(busca.value)[0]; if (s) escolher(s); }
    else if (e.key === "Escape") fechar();
  });
  lista.addEventListener("click", e => { const li = e.target.closest("[data-cod]"); if (li) escolher(cidades.find(c => c.cod === +li.dataset.cod)); });
  document.addEventListener("click", e => { if (!e.target.closest(".busca-comparar")) fechar(); });
  const pedida = new URLSearchParams(location.hash.slice(1)).get("m");
  const doFormulario = new URLSearchParams(location.search).get("c");
  const inicial = pedida ? cidades.find(c => c.cod === +pedida) : doFormulario ? procurar(doFormulario)[0] : null;
  if (inicial) escolher(inicial, false);
  else if (doFormulario) { busca.value = doFormulario; mostrar(); $("#m-resumo").textContent = "Nenhuma cidade com esse nome: confira a grafia."; }
}

// ler em voz alta: a voz do próprio aparelho lê os títulos e os parágrafos do conteúdo (sem tabelas, gráficos, menus
// nem o que está dentro de "mostrar mais" fechado), um trecho de cada vez: num texto só, alguns navegadores param no meio
function iniciarOuvir() {
  const b = $("#ouvir");
  if (!b || !("speechSynthesis" in window)) return;
  const fala = speechSynthesis;
  const fora = "table, svg, nav, script, style, .vh, [hidden], dialog, .ouvir-linha, .subnav, details:not([open]) > :not(summary)";
  const trechos = () => [...$("main").querySelectorAll("h1, h2, h3, h4, p, li")]
    .filter(el => !el.closest(fora) && !el.parentElement.closest("p, li") && el.offsetParent !== null)
    .map(el => el.innerText.replace(/\s+/g, " ").trim()).filter(t => t.length > 1);
  const voz = () => fala.getVoices().find(v => v.lang === "pt-BR") || fala.getVoices().find(v => v.lang.startsWith("pt"));
  // o botão é só um ícone: o nome muda no title (dica do mouse) e no texto escondido, que o leitor de tela lê
  const rotulo = t => { b.title = t; b.querySelector(".vh").textContent = t; };
  const parar = () => { fala.cancel(); rotulo("Ler em voz alta"); b.setAttribute("aria-pressed", "false"); };
  b.setAttribute("aria-pressed", "false");
  b.hidden = false;
  b.addEventListener("click", () => {
    if (b.getAttribute("aria-pressed") === "true") return parar();
    fala.cancel();
    const lista = trechos();
    lista.forEach((t, i) => {
      const u = Object.assign(new SpeechSynthesisUtterance(t), { lang: "pt-BR", rate: 1 });
      if (voz()) u.voice = voz();
      if (i === lista.length - 1) u.onend = parar;
      fala.speak(u);
    });
    rotulo("Parar a leitura"); b.setAttribute("aria-pressed", "true");
  });
  addEventListener("pagehide", () => fala.cancel());
}

// o Mais da barra do celular: abre e fecha o cartão com as outras seções; fecha com Esc, com um toque fora ou ao
// escolher um link
function iniciarMais() {
  const b = $(".barra-mais"), menu = $("#menu-mais");
  if (!b || !menu) return;
  const abrir = sim => { menu.hidden = !sim; b.setAttribute("aria-expanded", String(sim)); };
  b.addEventListener("click", () => {
    abrir(menu.hidden);
    if (!menu.hidden) menu.querySelector("a")?.focus();
  });
  document.addEventListener("click", ev => { if (!menu.hidden && !menu.contains(ev.target) && !b.contains(ev.target)) abrir(false); });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape" && !menu.hidden) { abrir(false); b.focus(); } });
  menu.addEventListener("click", ev => { if (ev.target.closest("a")) abrir(false); });
}

// tema: claro, escuro ou o do sistema (o padrão). A escolha fica no aparelho (localStorage) e vira data-tema no <html>,
// que o estilo.css lê; o <head> já a aplica antes de a página aparecer (pagina(), no gerador). Os três botões aparecem
// duas vezes: atrás do botão do tema, no cabeçalho, e dentro do Mais, no celular
function iniciarTema() {
  const raiz = document.documentElement, caixa = $("#tema");
  const botoes = [...document.querySelectorAll(".tema-opcoes [data-tema]")];
  if (!botoes.length) return;
  const atual = () => raiz.dataset.tema || "sistema";
  const pintar = () => {
    botoes.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tema === atual())));
    // a cor da barra do navegador acompanha o tema escolhido, e não o do sistema
    document.querySelectorAll('meta[name="theme-color"][data-tema]').forEach(m => m.setAttribute("media",
      atual() === "sistema" ? `(prefers-color-scheme: ${m.dataset.tema === "claro" ? "light" : "dark"})` : atual() === m.dataset.tema ? "all" : "not all"));
  };
  const escolher = tema => {
    if (tema === "sistema") delete raiz.dataset.tema; else raiz.dataset.tema = tema;
    try { tema === "sistema" ? localStorage.removeItem("tema") : localStorage.setItem("tema", tema); } catch { /* sem armazenamento: vale só nesta página */ }
    pintar();
  };
  botoes.forEach(b => b.addEventListener("click", () => escolher(b.dataset.tema)));
  if (caixa) {
    const botao = $(".tema-botao", caixa), opcoes = $("#tema-opcoes");
    const abrir = sim => { opcoes.hidden = !sim; botao.setAttribute("aria-expanded", String(sim)); };
    caixa.hidden = false;
    botao.addEventListener("click", () => abrir(opcoes.hidden));
    document.addEventListener("click", ev => { if (!opcoes.hidden && !caixa.contains(ev.target)) abrir(false); });
    document.addEventListener("keydown", ev => { if (ev.key === "Escape" && !opcoes.hidden) { abrir(false); botao.focus(); } });
  }
  pintar();
}

iniciarBusca();
iniciarPontos();
iniciarOuvir();
iniciarMais();
iniciarTema();
document.querySelectorAll("table.ordenavel").forEach(t => tabelaOrdenavel(t));
// abas de tipo de gasto que rolam (celular): a aba da página aberta aparece no meio da faixa, e não fora da tela
document.querySelectorAll(".abas").forEach(faixa => {
  const ativa = faixa.querySelector("[aria-current]");
  if (!ativa || faixa.scrollWidth <= faixa.clientWidth) return;
  const a = ativa.getBoundingClientRect(), f = faixa.getBoundingClientRect();
  faixa.scrollLeft += a.left - f.left - (f.width - a.width) / 2;
});
// página de fornecedor: cada gabinete em "Deputados que pagaram" e "Senadores que pagaram" abre a lista das notas
// daquele gabinete com este fornecedor. As notas vêm de dados/dep/<id>.json (o arquivo do perfil do deputado) ou de
// dados/sen/<código>.json (o da página do senador), filtradas pelo CNPJ formatado
function iniciarFornecedor() {
  const caixas = [...document.querySelectorAll(".gabinetes-forn")];
  if (!caixas.length) return;
  const docf = caixas[0].dataset.doc, POR_VEZ = 100;
  // as notas de um senador: [ano, data, tipo, fornecedor, número do documento, valor, número do PDF ou null]
  async function abrirSenador(det) {
    const alvo = $(".gf-notas", det);
    try {
      const sen = await json(`dados/sen/${det.dataset.sen}.json`);
      const linhas = sen.d.filter(n => sen.f[n[3]] && sen.f[n[3]][1] === docf);
      if (!linhas.length) { alvo.innerHTML = `<p class="cat">Nenhuma nota deste gabinete com este fornecedor nos meses publicados.</p>`; return; }
      let limite = POR_VEZ;
      const desenhar = () => {
        const corpo = linhas.slice(0, limite).map(n => `<tr><td><span class="mono">${esc(n[1] || String(n[0]))}</span><br><span class="cat">nº <span class="mono">${esc(n[4] || "s/n")}</span>
            · ${esc(sen.c[n[2]] || "")}</span></td><td class="n">${brl2(n[5])}</td>
            <td>${n[6] == null ? "—" : `<a href="${esc(sen.u + n[6])}" target="_blank" rel="noopener">ver nota<span class="vh"> (abre o site do Senado)</span></a>`}</td></tr>`).join("");
        const resto = linhas.length - limite;
        alvo.innerHTML = `<div class="rolagem tabela-alta"><table class="gf-tabela"><tr><th>Data</th><th class="n">Valor</th><th>Nota</th></tr>${corpo}</table></div>`
          + (resto > 0 ? `<button type="button" class="mais">Mostrar mais ${Math.min(resto, POR_VEZ)} de ${resto.toLocaleString("pt-BR")}</button>` : "");
        const mais = $(".mais", alvo);
        if (mais) mais.addEventListener("click", () => { limite += POR_VEZ; desenhar(); });
      };
      desenhar();
    } catch (erro) {
      console.error(erro);
      det.dataset.carregado = "";
      alvo.innerHTML = `<p class="cat">Não foi possível abrir as notas agora. Elas também estão na página do senador.</p>`;
    }
  }
  let resumo = null;
  const linkNota = (pid, meses, r) => {
    const ano = r[8] || Math.floor(meses[r[0]] / 100);
    if (r[7] === 0) return `https://www.camara.leg.br/cota-parlamentar/documentos/publ/${pid}/${ano}/${r[6]}.pdf`;
    if (r[7] === 1) return `https://www.camara.leg.br/cota-parlamentar/nota-fiscal-eletronica?ideDocumentoFiscal=${r[6]}`;
    return null;
  };
  async function abrir(det) {
    const alvo = $(".gf-notas", det), pid = det.dataset.pid;
    try {
      resumo = resumo || await json("dados/resumo.json");
      const dep = await json(`dados/dep/${pid}.json`);
      const linhas = dep.d.filter(r => dep.f[r[3]] && dep.f[r[3]][1] === docf);
      if (!linhas.length) { alvo.innerHTML = `<p class="cat">Nenhuma nota deste gabinete com este fornecedor nos meses publicados.</p>`; return; }
      let limite = POR_VEZ;
      const desenhar = () => {
        const corpo = linhas.slice(0, limite).map(r => {
          const url = linkNota(pid, resumo.meses, r);
          const valor = r[9] ? `<span class="cat">devolução de</span> ${brl2(r[9])}` : brl2(r[5]) + (r[10] ? glosaHTML(...r[10]) : "");
          // data, nº e tipo numa coluna só: no celular o valor e o link da nota cabem sem rolar a tabela de lado
          return `<tr><td><span class="mono">${esc(r[1] || nomeMes(resumo.meses[r[0]]))}</span><br><span class="cat">nº <span class="mono">${esc(r[4] || "s/n")}</span>
            · ${esc(resumo.categorias[r[2]] || "")}</span></td><td class="n">${valor}</td>
            <td>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">ver nota<span class="vh"> (abre o site da Câmara)</span></a>` : "—"}</td></tr>`;
        }).join("");
        const resto = linhas.length - limite;
        alvo.innerHTML = `<div class="rolagem tabela-alta"><table class="gf-tabela"><tr><th>Data</th><th class="n">Valor</th><th>Nota</th></tr>${corpo}</table></div>`
          + (resto > 0 ? `<button type="button" class="mais">Mostrar mais ${Math.min(resto, POR_VEZ)} de ${resto.toLocaleString("pt-BR")}</button>` : "")
          + (linhas.some(r => r[10]) ? `<p class="nota-tabela">O valor é o que a Câmara reembolsou. Quando ela não paga a nota inteira, a linha mostra também o valor da nota e a <b>glosa</b>, a parte que ficou sem reembolso.</p>` : "");
        const mais = $(".mais", alvo);
        if (mais) mais.addEventListener("click", () => { limite += POR_VEZ; desenhar(); });
      };
      desenhar();
    } catch (erro) {
      console.error(erro);
      det.dataset.carregado = "";
      alvo.innerHTML = `<p class="cat">Não foi possível abrir as notas agora. Elas também estão no perfil do deputado.</p>`;
    }
  }
  document.querySelectorAll("details.gab-forn").forEach(det => det.addEventListener("toggle", () => {
    if (det.open && !det.dataset.carregado) { det.dataset.carregado = "1"; det.dataset.sen ? abrirSenador(det) : abrir(det); }
  }));
}
// A página única da empresa (empresa.html#cnpj=<CNPJ>): monta, para qualquer CNPJ com dados, o mesmo desenho da
// página fixa (cidadania/site/__init__.py, _fornecedor): o que mudar lá muda aqui. Os dados vêm de
// dados/empresas/<três primeiros dígitos>.json: {t: [tipos de gasto], e: {CNPJ: [nome, município, UF, abertura,
// atividade, deputados [[id, notas, valor, primeira nota, nome se não tem perfil]], senadores [[código, notas, valor,
// primeira nota]], por ano [[ano, valor]], por tipo [[índice em t, valor]], sócios [[nome, qualificação, entrada]]]}}
async function iniciarEmpresa() {
  const alvo = $("#empresa");
  if (!alvo) return;
  const aviso = texto => {
    alvo.innerHTML = `<section class="abertura"><h1>Empresa</h1><p class="lead">${texto}</p>
      <p><a class="seguir" href="gastos/fornecedores.html">Ver todos os fornecedores</a></p></section>`;
  };
  const digitos = (new URLSearchParams(location.hash.slice(1)).get("cnpj") || "").replace(/\D/g, "");
  addEventListener("hashchange", () => location.reload());
  if (digitos.length !== 14) return aviso("Escolha uma empresa na lista de fornecedores ou na página de um estado.");
  let parte, deputados, senadores;
  try {
    [parte, deputados, senadores] = await Promise.all([json(`dados/empresas/${digitos.slice(0, 3)}.json`),
      json("dados/deputados.json"), json("dados/senadores.json").catch(() => [])]);
  } catch (erro) {
    console.error(erro);
    return aviso("Não foi possível carregar os dados agora. Tente de novo em instantes.");
  }
  const emp = parte.e[digitos];
  if (!emp) return aviso("Nenhuma despesa da cota parlamentar com este CNPJ desde fevereiro de 2023.");
  const [nome, municipio, uf, abertura, atividade, deps, sens, anual, tipos, socios] = emp;
  const docf = digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  const dataBR = s => s && s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—";
  const depPorId = Object.fromEntries(deputados.map(d => [d.id, d])), senPorCod = Object.fromEntries(senadores.map(s => [s.c, s]));
  const totalCamara = deps.reduce((s, d) => s + d[2], 0), totalSenado = sens.reduce((s, d) => s + d[2], 0), total = totalCamara + totalSenado;
  const sede = municipio ? `${municipio}/${uf || "—"}` : "";
  const quem = [deps.length ? `${deps.length} deputado${deps.length === 1 ? "" : "s"}` : "",
    sens.length ? `${sens.length} senador${sens.length === 1 ? "" : "es"}` : ""].filter(Boolean).join(" e ") || "nenhum gabinete";
  const kpis = [`<div class="cartao kpi"><b>${brl(total)}</b><span>recebidos da cota desde fev/2023</span></div>`];
  if (deps.length || !sens.length) kpis.push(`<div class="cartao kpi"><b>${deps.length}</b><span>${deps.length === 1 ? "deputado que pagou" : "deputados que pagaram"}${sens.length && deps.length ? ` · ${brlCurto(totalCamara)}` : ""}</span></div>`);
  if (sens.length) kpis.push(`<div class="cartao kpi"><b>${sens.length}</b><span>${sens.length === 1 ? "senador que pagou" : "senadores que pagaram"}${deps.length ? ` · ${brlCurto(totalSenado)}` : ""}</span></div>`);
  const barras = itens => {
    const maximo = Math.max(0, ...itens.map(i => i[1])) || 1;
    return itens.map(([rotulo, v]) => `<div class="barra"><span>${esc(String(rotulo))}</span><span class="trilho"><span style="width:${(100 * Math.max(v, 0) / maximo).toFixed(1)}%"></span></span><span class="valor">${brlCurto(v)}</span></div>`).join("");
  };
  const graficos = anual.length ? `<div class="duas secao">
    <section class="cartao"><h3>Ano a ano</h3><div class="barras">${barras(anual)}</div></section>
    <section class="cartao"><h3>Em que foi gasto</h3><div class="barras">${barras(tipos.map(([i, v]) => [parte.t[i], v]))}</div></section></div>` : "";
  const cadastro = [["CNPJ", docf], ["Constituída em", dataBR(abertura)], ["Atividade principal", atividade || "—"], ["Sede", sede || "—"]];
  const listaSocios = socios.map(([n, q, entrada]) => `<li>${esc(n)} <span class="cat">— ${esc(q)}${entrada ? `, desde ${dataBR(entrada)}` : ""}</span></li>`).join("");
  const numeros = (n, v, primeira) => `<span class="gf-num"><b>${brl2(v)}</b><small>${n.toLocaleString("pt-BR")} nota${n > 1 ? "s" : ""}${primeira ? ` · desde ${dataBR(primeira)}` : ""}</small></span>`;
  const gabDep = ([id, n, v, primeira, semPerfil]) => {
    const d = depPorId[id];
    if (!d) return `<div class="gab-forn gab-forn-fixo"><span class="gf-nome">${esc(semPerfil || `Deputado ${id}`)}</span>${numeros(n, v, primeira)}</div>`;
    return `<details class="gab-forn" data-pid="${id}"><summary><span class="gf-nome">${esc(d.n)} <span class="cat">${esc(d.p)}/${esc(d.uf)}</span></span>${numeros(n, v, primeira)}</summary>
      <div class="gf-corpo"><div class="gf-notas" aria-live="polite"><p class="cat">Abrindo as notas…</p></div>
      <p class="cat"><a href="deputado/${id}.html">Ver o perfil de ${esc(d.n)}</a></p></div></details>`;
  };
  const gabSen = ([cod, n, v, primeira]) => {
    const s = senPorCod[cod];
    if (!s) return `<div class="gab-forn gab-forn-fixo"><span class="gf-nome">Senador ${cod}</span>${numeros(n, v, primeira)}</div>`;
    return `<details class="gab-forn" data-sen="${cod}"><summary><span class="gf-nome">${esc(s.n)} <span class="cat">${esc([s.p, s.uf].filter(Boolean).join("/"))}</span></span>${numeros(n, v, primeira)}</summary>
      <div class="gf-corpo"><div class="gf-notas" aria-live="polite"><p class="cat">Abrindo as notas…</p></div>
      <p class="cat"><a href="senador/${cod}.html">Ver a página de ${esc(s.n)}</a></p></div></details>`;
  };
  const secao = (id, titulo, sub, linhas) => linhas.length ? `<section class="secao" id="${id}">
    <header><div><h2>${titulo}</h2><p>${sub}</p></div><span class="rotulo">toque num gabinete para ver as notas</span></header>
    <div class="cartao gabinetes-forn" data-doc="${docf}">${linhas.join("")}</div></section>` : "";
  alvo.innerHTML = `<section class="abertura"><h1>${esc(nome || docf)}</h1>
    <p class="identidade">${docf}${sede ? ` · ${esc(sede)}` : ""}</p>
    <p class="lead">Recebeu <b>${brlCurto(total)}</b> da cota parlamentar desde fevereiro de 2023, de ${quem}.
      Abaixo, o total por ano, por tipo de gasto e por gabinete, com as notas.</p></section>
    <div class="kpis">${kpis.join("")}</div>${graficos}
    <div class="duas secao">
      <section class="cartao"><h3>Cadastro na Receita Federal</h3><div class="rolagem"><table class="ficha-tabela">
        ${cadastro.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join("")}</table></div></section>
      <section class="cartao"><h3>Sócios e administradores</h3><ul class="socios">${listaSocios || "<li>Não informado pela Receita.</li>"}</ul></section>
    </div>
    ${secao("deputados", "Deputados que pagaram", `${brl(totalCamara)} da cota da Câmara. O valor é o reembolsado ao gabinete.`, deps.map(gabDep))}
    ${secao("senadores", "Senadores que pagaram", `${brl(totalSenado)} da cota do Senado, que informa só o valor reembolsado.`, sens.map(gabSen))}`;
  if (nome) {
    $("#emp-trilha").textContent = nome;
    document.title = `${nome} (${docf}) · fornecedor · De Olho na Cota`;
  }
  iniciarFornecedor();
}
// a página de alertas só existe com os alertas ligados; a de fornecedor e a da empresa existem nos dois sites
({ inicio: iniciarInicio, deputado: iniciarDeputado, alertas: ALERTAS ? iniciarAlertas : undefined, ranking: iniciarRanking, gastos: iniciarGastos,
  comparar: iniciarComparar, cidade: iniciarCidade, fornecedor: iniciarFornecedor, empresa: iniciarEmpresa,
  // o ano de cada gabinete vem do retrospectiva.js, que só essas páginas carregam
  retrospectiva: () => Retro.iniciar(), "retrospectiva-senadores": () => Retro.iniciar("s"),
  // as subabas do Senado usam as mesmas telas dos deputados; a página do senador vem do senado.js, que só ela carrega
  senadores: () => iniciarRanking("s"), "comparar-senadores": () => iniciarComparar("s"),
  senador: () => Senado.iniciarSenador() })[document.body.dataset.pagina]?.();
