"use strict";

// Posição aproximada de cada estado numa grade 8 × 8 (coluna, linha)
const GRADE = {
  RR: [2, 0], AP: [4, 0],
  AM: [1, 1], PA: [3, 1], MA: [5, 1], CE: [6, 1], RN: [7, 1],
  AC: [0, 2], RO: [1, 2], MT: [2, 2], TO: [4, 2], PI: [5, 2], PE: [6, 2], PB: [7, 2],
  MS: [2, 3], GO: [3, 3], DF: [4, 3], BA: [5, 3], AL: [6, 3],
  SP: [3, 4], MG: [4, 4], ES: [5, 4], SE: [6, 4],
  PR: [3, 5], RJ: [4, 5],
  SC: [3, 6],
  RS: [2, 7],
};
const NOMES_UF = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul",
  MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
  SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

const brl = v => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brlCurto = v => v >= 1e6 ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`
  : `R$ ${Math.round(v / 1e3).toLocaleString("pt-BR")} mil`;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = s => document.querySelector(s);

function pills(d) {
  const p = [];
  if (d.g3) p.push(`<span class="pill g3">${d.g3} alta${d.g3 > 1 ? "s" : ""}</span>`);
  if (d.g2) p.push(`<span class="pill g2">${d.g2} média${d.g2 > 1 ? "s" : ""}</span>`);
  return p.length ? `<span class="pills">${p.join("")}</span>` : `<span class="pills"><span class="pill g1">sem alertas graves</span></span>`;
}

// ------------------------------------------------------------------ página inicial: mapa + lista
async function iniciarMapa() {
  const deputados = await (await fetch("dados/deputados.json")).json();
  const estado = { uf: null, partidos: new Set(), busca: "", ordem: "alertas", situacao: "exercicio", metrica: "gasto", limite: 40 };

  // estado inicial pela URL (#uf=SP&p=PT,PL), para links compartilháveis
  const h = new URLSearchParams(location.hash.slice(1));
  if (GRADE[h.get("uf")]) estado.uf = h.get("uf");
  if (h.get("p")) h.get("p").split(",").forEach(p => estado.partidos.add(p));

  const mapa = $("#mapa");
  mapa.innerHTML = Object.entries(GRADE).map(([uf, [c, l]]) =>
    `<button class="uf" data-uf="${uf}" style="grid-column:${c + 1};grid-row:${l + 1}" aria-pressed="false"
      title="${NOMES_UF[uf]}"><span>${uf}</span><small></small></button>`).join("");

  const porSituacao = d => estado.situacao === "todos" || d.em_exercicio;
  const porPartido = d => !estado.partidos.size || estado.partidos.has(d.partido);

  function desenharPartidos() {
    const contagem = {};
    deputados.filter(d => porSituacao(d) && (!estado.uf || d.uf === estado.uf))
      .forEach(d => contagem[d.partido] = (contagem[d.partido] || 0) + 1);
    estado.partidos.forEach(p => contagem[p] ??= 0);
    $("#partidos").innerHTML = Object.entries(contagem).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([p, n]) => `<button class="chip" data-p="${esc(p)}" aria-pressed="${estado.partidos.has(p)}">${esc(p)}<span class="num">${n}</span></button>`)
      .join("");
  }

  function desenharMapa() {
    const valores = {};
    for (const uf of Object.keys(GRADE)) {
      const lista = deputados.filter(d => d.uf === uf && porSituacao(d) && porPartido(d));
      const soma = lista.reduce((s, d) => s + (estado.metrica === "gasto" ? d.total : d.g3 * 3 + d.g2), 0);
      valores[uf] = { n: lista.length, media: lista.length ? soma / lista.length : null };
    }
    const medias = Object.values(valores).map(v => v.media).filter(v => v !== null).sort((a, b) => a - b);
    const quantil = q => medias[Math.min(medias.length - 1, Math.floor(q * medias.length))];
    const cortes = [0.2, 0.4, 0.6, 0.8].map(quantil);
    mapa.querySelectorAll(".uf").forEach(b => {
      const v = valores[b.dataset.uf];
      // cinco faixas pelos quintis entre os estados; sem deputados no filtro, o ladrilho fica vazio
      b.dataset.n = v.media === null ? "vazio" : cortes.filter(c => v.media > c).length;
      b.querySelector("small").textContent = v.n;
      b.setAttribute("aria-pressed", String(b.dataset.uf === estado.uf));
      const desc = estado.metrica === "gasto" ? `gasto médio ${v.media === null ? "—" : brl(v.media)}` : `índice de alertas ${v.media === null ? "—" : v.media.toFixed(1)}`;
      b.setAttribute("aria-label", `${NOMES_UF[b.dataset.uf]}: ${v.n} deputados, ${desc}`);
    });
    mapa.classList.toggle("com-selecao", !!estado.uf);
    $("#legenda-texto").textContent = estado.metrica === "gasto" ? "Gasto médio por deputado" : "Alertas graves por deputado";
  }

  function desenharLista() {
    const q = estado.busca.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    const lista = deputados.filter(d => porSituacao(d) && porPartido(d) && (!estado.uf || d.uf === estado.uf) &&
      (!q || d.busca.includes(q)));
    const ordem = {
      alertas: (a, b) => b.g3 - a.g3 || b.g2 - a.g2 || b.total - a.total,
      gasto: (a, b) => b.total - a.total,
      nome: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
    }[estado.ordem];
    lista.sort(ordem);
    const lugar = estado.uf ? NOMES_UF[estado.uf] : "Brasil";
    $("#lista-titulo").textContent = lugar;
    const total = lista.reduce((s, d) => s + d.total, 0);
    $("#lista-resumo").textContent = lista.length
      ? `${lista.length} deputado${lista.length > 1 ? "s" : ""} · ${brlCurto(total)} em reembolsos da cota`
      : "Nenhum deputado com esses filtros";
    $("#linhas").innerHTML = lista.slice(0, estado.limite).map(d => `
      <li><a class="linha" href="deputado/${d.id}.html">
        <img class="foto" src="${esc(d.foto)}" alt="" loading="lazy" width="44" height="44">
        <span><span class="nome">${esc(d.nome)}</span><br><span class="meta">${esc(d.partido)} · ${esc(d.uf)}${d.em_exercicio ? "" : " · fora do exercício"}</span></span>
        <span class="direita"><span class="total">${brl(d.total)}</span><br>${pills(d)}</span>
      </a></li>`).join("") || `<li class="vazio">Nenhum deputado encontrado. Tire algum filtro de partido ou limpe a busca.</li>`;
    $("#mais").hidden = lista.length <= estado.limite;
    $("#mais").textContent = `Mostrar mais ${Math.min(40, lista.length - estado.limite)} de ${lista.length - estado.limite} restantes`;
  }

  function atualizar() {
    desenharPartidos();
    desenharMapa();
    desenharLista();
    const h = new URLSearchParams();
    if (estado.uf) h.set("uf", estado.uf);
    if (estado.partidos.size) h.set("p", [...estado.partidos].join(","));
    history.replaceState(null, "", h.toString() ? `#${h}` : location.pathname);
  }

  mapa.addEventListener("click", e => {
    const b = e.target.closest(".uf"); if (!b) return;
    estado.uf = estado.uf === b.dataset.uf ? null : b.dataset.uf; estado.limite = 40; atualizar();
    // no celular a lista fica abaixo do mapa: leva a pessoa até ela
    if (estado.uf && window.matchMedia("(max-width: 900px)").matches) {
      $(".lista-cartao").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  });
  $("#partidos").addEventListener("click", e => {
    const b = e.target.closest(".chip"); if (!b) return;
    estado.partidos.has(b.dataset.p) ? estado.partidos.delete(b.dataset.p) : estado.partidos.add(b.dataset.p);
    estado.limite = 40; atualizar();
  });
  $("#limpar").addEventListener("click", () => { estado.uf = null; estado.partidos.clear(); estado.busca = ""; $("#busca").value = ""; atualizar(); });
  $("#busca").addEventListener("input", e => { estado.busca = e.target.value; estado.limite = 40; desenharLista(); });
  $("#ordem").addEventListener("change", e => { estado.ordem = e.target.value; desenharLista(); });
  $("#situacao").addEventListener("change", e => { estado.situacao = e.target.value; atualizar(); });
  $("#mais").addEventListener("click", () => { estado.limite += 40; desenharLista(); });
  document.querySelectorAll("[data-metrica]").forEach(b => b.addEventListener("click", () => {
    estado.metrica = b.dataset.metrica;
    document.querySelectorAll("[data-metrica]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    desenharMapa();
  }));
  atualizar();
}

// ------------------------------------------------------------------ página de alertas
async function iniciarAlertas() {
  const { alertas, regras, deputados } = await (await fetch("dados/alertas.json")).json();
  const estado = { regra: "", gravidade: "3", uf: "", busca: "", limite: 50 };
  const sel = $("#f-regra");
  regras.forEach(r => sel.insertAdjacentHTML("beforeend", `<option value="${r.codigo}">${esc(r.titulo)}</option>`));
  Object.keys(NOMES_UF).sort().forEach(uf => $("#f-uf").insertAdjacentHTML("beforeend", `<option>${uf}</option>`));
  const titulo = Object.fromEntries(regras.map(r => [r.codigo, r.titulo]));
  const GRAV = { 3: "Alta", 2: "Média", 1: "Baixa" };

  function desenhar() {
    const q = estado.busca.toLowerCase();
    const lista = alertas.filter(a => {
      const d = deputados[a.p];
      return (!estado.regra || a.r === estado.regra) && (!estado.gravidade || a.g >= +estado.gravidade) &&
        (!estado.uf || d.uf === estado.uf) && (!q || `${a.t} ${d.nome} ${d.partido}`.toLowerCase().includes(q));
    });
    $("#contagem").textContent = `${lista.length.toLocaleString("pt-BR")} alerta(s)`;
    $("#lista-alertas").innerHTML = lista.slice(0, estado.limite).map(a => {
      const d = deputados[a.p];
      const notas = a.n.map(n => `<li>${esc(n[1] || "sem data")} · nota ${esc(n[0] || "s/n")} · <span class="num">${brl(n[2])}</span>${n[3] ? ` · <a href="${esc(n[3])}" target="_blank" rel="noopener">ver nota</a>` : ""}</li>`).join("");
      return `<article class="alerta"><div class="cab"><span class="pill g${a.g}">${GRAV[a.g]}</span><strong>${esc(titulo[a.r])}</strong>
        <span>· <a href="deputado/${a.p}.html">${esc(d.nome)}</a> (${esc(d.partido)}/${esc(d.uf)})</span></div>
        <p>${esc(a.t)}</p>${a.v ? `<p class="revisao">Revisão: ${esc(a.v)}</p>` : ""}
        ${notas ? `<details><summary>Notas envolvidas</summary><ul>${notas}</ul></details>` : ""}</article>`;
    }).join("") || `<p class="vazio">Nenhum alerta com esses filtros. Escolha outra gravidade ou limpe a busca.</p>`;
    $("#mais").hidden = lista.length <= estado.limite;
  }
  [["#f-regra", "regra"], ["#f-grav", "gravidade"], ["#f-uf", "uf"], ["#f-busca", "busca"]].forEach(([s, k]) =>
    $(s).addEventListener("input", e => { estado[k] = e.target.value; estado.limite = 50; desenhar(); }));
  $("#mais").addEventListener("click", () => { estado.limite += 50; desenhar(); });
  desenhar();
}

if (document.body.dataset.pagina === "inicio") iniciarMapa();
if (document.body.dataset.pagina === "alertas") iniciarAlertas();
