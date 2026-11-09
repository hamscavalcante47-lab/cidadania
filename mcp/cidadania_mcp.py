"""De Olho na Cota no seu assistente de IA (servidor MCP).

Responde, com os dados abertos do site De Olho na Cota, a perguntas como "quanto o deputado X gastou da cota em 2025?",
"que alertas confirmados existem em Minas Gerais?" ou "quem os eleitores de Campina Grande escolheram para a Câmara?".
Cada resposta traz o link da página do site, para conferir.

Usa só a biblioteca padrão do Python 3.10 ou mais novo. No Claude Desktop, por exemplo, acrescente em
claude_desktop_config.json (troque o caminho pelo lugar onde salvou este arquivo):

    {"mcpServers": {"cidadania": {"command": "python", "args": ["C:/caminho/cidadania_mcp.py"]}}}

Os dados vêm do site publicado (a variável CIDADANIA_SITE troca o endereço; uma pasta local também serve).
"""
import json
import os
import sys
import unicodedata
import urllib.request
from functools import lru_cache
from pathlib import Path

SITE = os.environ.get("CIDADANIA_SITE", "https://hamscavalcante47-lab.github.io/cidadania/").rstrip("/") + "/"
PROTOCOLO = "2025-06-18"
GRAVIDADE = {3: "alta", 2: "média", 1: "baixa"}


def _normalizar(texto):
    return unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode().lower().strip()


@lru_cache(maxsize=64)
def _dados(caminho):
    if SITE.startswith(("http://", "https://")):
        pedido = urllib.request.Request(SITE + "dados/" + caminho, headers={"User-Agent": "cidadania-mcp"})
        with urllib.request.urlopen(pedido, timeout=60) as resposta:
            return json.loads(resposta.read().decode("utf-8"))
    return json.loads((Path(SITE) / "dados" / caminho).read_text(encoding="utf-8"))


def _deputados():
    return _dados("deputados.json")


def _deputado(id_):
    d = next((d for d in _deputados() if d["id"] == int(id_)), None)
    if not d:
        raise ValueError(f"não há deputado com id {id_}; use procurar_gabinete para achar o id")
    return d


def _alertas_do(d):
    confirmados = sum(1 for a in d["a"] if len(a) > 2)
    return {"confirmados_na_revisao": confirmados, "apontados_altos": d["g3"], "apontados_medios": d["g2"],
            "apontados_baixos": d["g1"]}


def _ficha(d):
    return {"id": d["id"], "nome": d["n"], "partido": d["p"], "uf": d["uf"], "em_exercicio": d["x"],
            "total_reembolsado": d["t"], "alertas": _alertas_do(d), "pagina": f"{SITE}deputado/{d['id']}.html"}


def _meses_do_periodo(ano=None, mes=None):
    meses = _dados("resumo.json")["meses"]
    return {i for i, m in enumerate(meses) if (not ano or m // 100 == int(ano)) and (not mes or m % 100 == int(mes))}


# ---------------------------------------------------------------- ferramentas

def procurar_gabinete(nome, uf=None):
    q = _normalizar(nome)
    achados = [d for d in _deputados() if q in d["b"] and (not uf or d["uf"] == uf.upper())]
    return {"encontrados": len(achados), "deputados": [_ficha(d) for d in achados[:20]]}


def resumo_do_gabinete(id, ano=None):
    d = _deputado(id)
    resumo = _dados("resumo.json")
    idx = _meses_do_periodo(ano)
    dep = _dados(f"dep/{d['id']}.json")
    por_tipo = {}
    for r in dep["d"]:
        if r[0] in idx:
            por_tipo[r[2]] = por_tipo.get(r[2], 0) + r[5]
    presenca = _dados("presenca.json").get(str(d["id"]), [])
    dias = sum(x[1] for x in presenca if x[0] in idx)
    presente = sum(x[2] for x in presenca if x[0] in idx)
    faltas = sum(x[3] for x in presenca if x[0] in idx)
    return {**_ficha(d), "periodo": str(ano) if ano else "toda a legislatura",
            "reembolsado_no_periodo": round(sum(d["m"][i] or 0 for i in idx)),
            "maiores_tipos_de_gasto": [{"tipo": resumo["categorias"][c], "valor": round(v)}
                                       for c, v in sorted(por_tipo.items(), key=lambda x: -x[1])[:5]],
            "plenario": {"dias_de_sessao": dias, "presente": presente, "faltas_sem_justificativa": faltas},
            "aviso": "Alerta apontado não é acusação: é um padrão nos dados que pede explicação. Os confirmados foram "
                     "conferidos nos documentos pela revisão."}


def indicios(gravidade_minima=2, uf=None, deputado_id=None, regra=None, so_confirmados=False, limite=20):
    meta = _dados("alertas-meta.json")
    titulos = {r["codigo"]: r["titulo"] for r in meta["regras"]}
    deputados = meta["deputados"]
    lista = [a for g in (3, 2, 1) if g >= int(gravidade_minima) for a in _dados(f"alertas-{g}.json")]
    lista = [a for a in lista if (not uf or deputados[str(a["p"])]["uf"] == uf.upper())
             and (not deputado_id or a["p"] == int(deputado_id)) and (not regra or a["r"] == regra)
             and (not so_confirmados or a.get("s") == "confirmado")]
    return {"encontrados": len(lista), "alertas": [{
        "codigo": a["c"], "gravidade": GRAVIDADE[a["g"]], "regra": a["r"], "titulo": titulos.get(a["r"]),
        "deputado": f"{deputados[str(a['p'])]['nome']} ({deputados[str(a['p'])]['partido']}/{deputados[str(a['p'])]['uf']})",
        "deputado_id": a["p"], "valor_envolvido": a["vl"], "descricao": a["t"],
        "revisao": a.get("rl") or "revisão pendente", "nota_da_revisao": a.get("v"),
        "pagina": f"{SITE}alerta/{a['c']}.html"} for a in lista[:int(limite)]],
        "aviso": "Alerta não prova irregularidade. Confira a nota original na página de cada um."}


def regra(codigo):
    regra = _dados("regras.json").get(codigo)
    if not regra:
        raise ValueError(f"regra {codigo} não existe; os códigos aparecem em indicios")
    return {"codigo": codigo, "titulo": regra["t"], "explicacao": regra["x"], "gravidade": GRAVIDADE[regra["g"]],
            "metodologia": f"{SITE}metodologia.html"}


def notas_do_gabinete(deputado_id, ano=None, mes=None, tipo=None, fornecedor=None, limite=50):
    d = _deputado(deputado_id)
    resumo = _dados("resumo.json")
    dep = _dados(f"dep/{d['id']}.json")
    idx = _meses_do_periodo(ano, mes)

    def link(r):
        ano_doc = r[8] if len(r) > 8 else resumo["meses"][r[0]] // 100
        if r[7] == 0:
            return f"https://www.camara.leg.br/cota-parlamentar/documentos/publ/{d['id']}/{ano_doc}/{r[6]}.pdf"
        if r[7] == 1:
            return f"https://www.camara.leg.br/cota-parlamentar/nota-fiscal-eletronica?ideDocumentoFiscal={r[6]}"
        return None
    linhas = [r for r in dep["d"] if r[0] in idx
              and (not tipo or _normalizar(tipo) in _normalizar(resumo["categorias"][r[2]]))
              and (not fornecedor or _normalizar(fornecedor) in _normalizar(" ".join(dep["f"][r[3]])))]
    return {"deputado": f"{d['n']} ({d['p']}/{d['uf']})", "despesas": len(linhas),
            "total": round(sum(r[5] for r in linhas), 2), "lista": [{
                "data": r[1], "tipo": resumo["categorias"][r[2]], "fornecedor": dep["f"][r[3]][0],
                "cnpj_cpf": dep["f"][r[3]][1], "numero": r[4], "valor": r[5], "nota": link(r)}
                for r in linhas[:int(limite)]],
            "pagina": f"{SITE}deputado/{d['id']}.html#despesas"}


def comparar_gabinetes(ids, ano=None):
    if not 2 <= len(ids) <= 5:
        raise ValueError("compare de 2 a 5 deputados")
    return {"deputados": [resumo_do_gabinete(i, ano) for i in ids],
            "pagina": f"{SITE}comparar.html#ids={','.join(str(i) for i in ids)}" + (f"&per={ano}" if ano else ""),
            "aviso": "Estado, cargo na Mesa e liderança mudam o limite da cota: compare de preferência deputados do mesmo estado."}


def voto_da_cidade(cidade, uf=None):
    indice = _dados("municipios.json")
    q = _normalizar(cidade)
    candidatas = [m for m in indice["m"] if _normalizar(m[1]) == q and (not uf or m[0] == uf.upper())]
    if not candidatas:
        candidatas = [m for m in indice["m"] if q in _normalizar(m[1]) and (not uf or m[0] == uf.upper())]
    if not candidatas:
        raise ValueError(f"cidade {cidade} não encontrada")
    if len(candidatas) > 1 and not uf:
        return {"varias_cidades": [f"{m[1]} ({m[0]})" for m in candidatas[:10]], "dica": "informe também a uf"}
    estado, nome, cod = candidatas[0]
    total, votos = _dados(f"votos/{estado.lower()}.json").get(str(cod), [0, []])
    porid = {d["id"]: d for d in _deputados()}
    return {"cidade": f"{nome} ({estado})", "eleicao": indice["ano"],
            "deputados_em_exercicio_no_estado": sum(1 for d in _deputados() if d["uf"] == estado and d["x"]),
            "mais_votados_aqui": [{**_ficha(porid[i]), "votos_na_cidade": n,
                                   "fatia_dos_votos": round(100 * n / total, 1) if total else None}
                                  for i, n in votos[:10] if i in porid],
            "aviso": "O deputado federal representa o estado inteiro; o voto mostra quem a cidade escolheu.",
            "pagina": f"{SITE}voto-da-cidade.html#m={cod}"}


TEXTO = {"type": "string"}
INTEIRO = {"type": "integer"}
FERRAMENTAS = {
    "procurar_gabinete": (procurar_gabinete, "Acha deputados federais pelo nome (e, se quiser, pelo estado). Devolve o id "
                        "usado nas outras ferramentas, o total reembolsado da cota e os alertas.",
                        {"nome": TEXTO, "uf": TEXTO}, ["nome"]),
    "resumo_do_gabinete": (resumo_do_gabinete, "Resumo de um deputado: cota reembolsada (toda a legislatura ou um ano), maiores tipos "
                     "de gasto, presença no Plenário e alertas apontados e confirmados.",
                     {"id": INTEIRO, "ano": INTEIRO}, ["id"]),
    "indicios": (indicios, "Alertas das regras automáticas sobre a cota, com filtros por gravidade mínima "
                       "(1 a 3), estado, deputado, regra e só os confirmados na revisão.",
                       {"gravidade_minima": INTEIRO, "uf": TEXTO, "deputado_id": INTEIRO, "regra": TEXTO,
                        "so_confirmados": {"type": "boolean"}, "limite": INTEIRO}, []),
    "regra": (regra, "O que uma regra de alerta confere e por que o padrão chama atenção.",
                       {"codigo": TEXTO}, ["codigo"]),
    "notas_do_gabinete": (notas_do_gabinete, "Cada despesa reembolsada de um deputado, com fornecedor, valor e link da nota "
                      "fiscal na Câmara; filtra por ano, mês, tipo de gasto e fornecedor.",
                      {"deputado_id": INTEIRO, "ano": INTEIRO, "mes": INTEIRO, "tipo": TEXTO, "fornecedor": TEXTO,
                       "limite": INTEIRO}, ["deputado_id"]),
    "comparar_gabinetes": (comparar_gabinetes, "De 2 a 5 gabinetes em colunas, com os mesmos números, sem nota nem ranking.",
                           {"ids": {"type": "array", "items": INTEIRO}, "ano": INTEIRO}, ["ids"]),
    "voto_da_cidade": (voto_da_cidade, "Em quem uma cidade votou para deputado federal em 2022 e como esses "
                           "gabinetes usam a cota.", {"cidade": TEXTO, "uf": TEXTO}, ["cidade"]),
}


def _responder(pedido):
    metodo, params = pedido.get("method"), pedido.get("params") or {}
    if metodo == "initialize":
        return {"protocolVersion": params.get("protocolVersion", PROTOCOLO), "capabilities": {"tools": {}},
                "serverInfo": {"name": "cidadania", "version": "1.0"},
                "instructions": "Dados da cota parlamentar dos deputados federais desde fev/2023. Alerta não é "
                                "acusação: diga sempre se foi confirmado na revisão e dê o link da página."}
    if metodo == "tools/list":
        return {"tools": [{"name": nome, "description": descricao,
                           "inputSchema": {"type": "object", "properties": props, "required": obrigatorios}}
                          for nome, (_, descricao, props, obrigatorios) in FERRAMENTAS.items()]}
    if metodo == "tools/call":
        funcao = FERRAMENTAS[params["name"]][0]
        try:
            resultado = funcao(**(params.get("arguments") or {}))
            return {"content": [{"type": "text", "text": json.dumps(resultado, ensure_ascii=False, indent=1)}]}
        except Exception as erro:  # o assistente lê o erro e tenta de outro jeito
            return {"content": [{"type": "text", "text": f"Erro: {erro}"}], "isError": True}
    if metodo == "ping":
        return {}
    raise KeyError(metodo)


def main():
    # o protocolo é UTF-8; no Windows a entrada e a saída padrão viriam na página de código do sistema
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    for linha in sys.stdin:
        if not linha.strip():
            continue
        pedido = json.loads(linha)
        if "id" not in pedido:  # notificação (notifications/initialized): não tem resposta
            continue
        try:
            resposta = {"jsonrpc": "2.0", "id": pedido["id"], "result": _responder(pedido)}
        except KeyError as erro:
            resposta = {"jsonrpc": "2.0", "id": pedido["id"], "error": {"code": -32601, "message": f"método {erro} não existe"}}
        sys.stdout.write(json.dumps(resposta, ensure_ascii=False) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
