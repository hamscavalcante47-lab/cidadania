"use strict";
// Página de cada senador (senador/<código>.html): a lista das notas, lida de dados/sen/<código>.json. Carregado só
// nela, antes do app.js, que chama Senado.iniciarSenador; usa os utilitários do app.js (esc, brl2, json, $). O ranking
// dos senadores, Comparar e O ano de cada gabinete usam as telas dos deputados (app.js e retrospectiva.js).
// Os dados de cada nota (d): [ano, data, tipo, fornecedor, número do documento, valor, número do PDF]. O número do PDF
// é null quando a despesa não tem link e 0 quando o link existe mas o Senado não publicou o arquivo.
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
    linhas.push([n[0], n[1], dados.c[n[2]], nome, doc, n[4], String(n[5]).replace(".", ","), n[6] ? dados.u + n[6] : ""]);
  }
  return "﻿" + linhas.map(l => l.map(campo).join(";")).join("\r\n");
}

// ------------------------------------------------------------------ página

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
        : n[6] === 0 ? `<span class="ns-sem" title="O link existe, mas o Senado responde vazio">arquivo não publicado pelo Senado</span>`
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

exportar.Senado = { iniciarSenador, filtrarNotas, csvNotas };
})(typeof module === "object" ? module.exports : window);
