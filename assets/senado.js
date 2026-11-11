"use strict";
// Páginas do Senado: o filtro da lista dos senadores (senadores.html) e a lista das notas de cada senador
// (senador/<código>.html), lida de dados/sen/<código>.json. Carregado só nessas páginas, antes do app.js, que chama
// Senado.iniciarLista ou Senado.iniciarSenador; usa os utilitários do app.js (esc, brl2, brlCurto, json, $).
// Os dados de cada nota (d): [ano, data, tipo, fornecedor, número do documento, valor, número do PDF ou null].
(function (exportar) {

const POR_VEZ = 50;
// a mesma do app.js: este arquivo roda antes dele (e sozinho nos testes do Node)
const norm = s => (s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// ------------------------------------------------------------------ lógica (sem página: testada no Node)

// as notas que passam nos filtros, na ordem do arquivo (da mais nova para a mais antiga)
function filtrarNotas(dados, { ano = "", tipo = "", busca = "" } = {}) {
  const termos = norm(busca.trim()).split(/\s+/).filter(Boolean);
  const digitos = busca.replace(/\D/g, "");
  return dados.d.filter(n => {
    if (ano && n[0] !== Number(ano)) return false;
    if (tipo !== "" && n[2] !== Number(tipo)) return false;
    if (!termos.length) return true;
    const [nome, doc] = dados.f[n[3]];
    const alvo = norm(`${nome} ${doc}`);
    return termos.every(t => alvo.includes(t)) || (digitos.length >= 4 && doc.replace(/\D/g, "").includes(digitos));
  });
}

// a planilha das notas filtradas: uma linha por nota, com o link do documento
function csvNotas(dados, notas) {
  const campo = v => /[";\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const linhas = [["Ano", "Data", "Tipo de gasto", "Fornecedor", "CNPJ/CPF", "Documento", "Valor reembolsado", "Link do documento"]];
  for (const n of notas) {
    const [nome, doc] = dados.f[n[3]];
    linhas.push([n[0], n[1], dados.c[n[2]], nome, doc, n[4], String(n[5]).replace(".", ","), n[6] == null ? "" : dados.u + n[6]]);
  }
  return "﻿" + linhas.map(l => l.map(campo).join(";")).join("\r\n");
}

// a ordem da lista dos senadores: pelo nome (como o gerador escreveu) ou pelo maior gasto
function ordenarSenadores(itens, ordem) {
  return ordem === "gasto" ? [...itens].sort((a, b) => b.t - a.t || a.i - b.i) : [...itens].sort((a, b) => a.i - b.i);
}

// ------------------------------------------------------------------ páginas

function iniciarLista() {
  const lista = $("#sen-linhas");
  if (!lista) return;
  const itens = [...lista.children].map((li, i) => ({ li, i, t: Number(li.dataset.t), uf: li.dataset.uf, x: li.dataset.x === "1", b: li.dataset.b }));
  const busca = $("#sen-busca"), uf = $("#sen-uf"), situacao = $("#sen-situacao"), ordem = $("#sen-ordem");
  const vazio = Object.assign(document.createElement("li"), { className: "vazio", textContent: "Nenhum senador com esses filtros. Escolha “Todos com despesas” ou limpe a busca." });
  function aplicar() {
    const termos = norm(busca.value.trim()).split(/\s+/).filter(Boolean);
    let total = 0, n = 0;
    for (const it of ordenarSenadores(itens, ordem.value)) {
      const ve = (!uf.value || it.uf === uf.value) && (situacao.value === "todos" || it.x) && termos.every(t => it.b.includes(t));
      it.li.hidden = !ve;
      lista.append(it.li);
      if (ve) { total += it.t; n++; }
    }
    vazio.remove();
    if (!n) lista.append(vazio);
    $("#sen-resumo").textContent = n ? `${n} senador${n > 1 ? "es" : ""} · ${brlCurto(total)} desde fevereiro de 2023` : "Nenhum senador com esses filtros";
  }
  [busca, uf, situacao, ordem].forEach(c => c.addEventListener(c === busca ? "input" : "change", aplicar));
  aplicar();
}

async function iniciarSenador() {
  const alvo = $("#sn-lista");
  if (!alvo) return;
  const codigo = JSON.parse($("#dados-senador").textContent).codigo;
  let dados;
  try {
    dados = await json(`dados/sen/${codigo}.json`);
  } catch (erro) {
    console.error(erro);
    $("#sn-resumo").textContent = "Não foi possível carregar as notas agora. Tente de novo em instantes.";
    return;
  }
  const ano = $("#sn-ano"), tipo = $("#sn-tipo"), busca = $("#sn-busca"), mais = $("#sn-mais"), csv = $("#sn-csv");
  let notas = [], limite = POR_VEZ;
  function desenhar() {
    const total = notas.reduce((s, n) => s + n[5], 0);
    $("#sn-resumo").textContent = notas.length ? `${notas.length.toLocaleString("pt-BR")} nota${notas.length > 1 ? "s" : ""} · ${brl2(total)}` : "Nenhuma nota com esses filtros";
    alvo.innerHTML = notas.slice(0, limite).map(n => {
      const [nome, doc] = dados.f[n[3]];
      const pdf = n[6] == null ? `<span class="ns-sem">sem documento</span>`
        : `<a class="ns-pdf sai" href="${esc(dados.u + n[6])}" target="_blank" rel="noopener">Documento</a>`;
      return `<li class="nota-sen"><div class="ns-texto"><span class="ns-forn">${esc(nome)}</span>
        <span class="ns-meta">${esc(n[1] || "sem data")}${n[4] ? ` · nº&nbsp;${esc(n[4])}` : ""}</span>
        <span class="ns-meta">${esc(dados.c[n[2]])}</span>${doc ? `<span class="ns-meta mono">${esc(doc)}</span>` : ""}</div>
        <div class="ns-dir"><span class="ns-valor${n[5] < 0 ? " devolucao" : ""}">${brl2(n[5])}</span>${pdf}</div></li>`;
    }).join("");
    const resto = notas.length - limite;
    mais.hidden = resto <= 0;
    mais.textContent = `Mostrar mais ${Math.min(POR_VEZ, resto)} de ${resto.toLocaleString("pt-BR")} restantes`;
  }
  function aplicar() {
    notas = filtrarNotas(dados, { ano: ano.value, tipo: tipo.value, busca: busca.value });
    limite = POR_VEZ;
    desenhar();
  }
  [ano, tipo].forEach(c => c.addEventListener("change", aplicar));
  busca.addEventListener("input", aplicar);
  mais.addEventListener("click", () => { limite += POR_VEZ; desenhar(); });
  csv.hidden = false;
  csv.addEventListener("click", () => {
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csvNotas(dados, notas)], { type: "text/csv;charset=utf-8" })),
      download: `senado-${codigo}-notas.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  aplicar();
}

exportar.Senado = { iniciarLista, iniciarSenador, filtrarNotas, csvNotas, ordenarSenadores };
})(typeof module === "object" ? module.exports : window);
