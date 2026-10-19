// Os retratos na live: roda no navegador do OBS, não no Mestre.
//
// Dois modos, pelo link:
//   ?modo=grupo          os retratos no ar, onde a mesa os pôs (fonte 16:9)
//   ?personagem={id}     o card de um personagem, encaixado na caixa da fonte
//
// Assina o canal "retratos" que main.js publica e pede ao kit de retratos do
// ATO20 (/kit/retratos, num iframe) que desenhe -- com o dado de quem jogou
// caindo embaixo do retrato, como na TV.

import { textosPara } from "./textos.js";

const busca = new URLSearchParams(location.search);
// O painel põe `idioma=en` no link quando o Mestre está em inglês.
const t = textosPara(busca.get("idioma") === "en" ? "en" : "pt-BR");
if (busca.get("idioma") === "en") document.documentElement.lang = "en";
const codigo = (busca.get("code") ?? "").trim().toUpperCase();
const personagem = busca.get("personagem") || null;
// /plugin/{id}/retratos.html: o id vem do caminho, e não escrito aqui.
const plugin = location.pathname.split("/")[2];

const aviso = document.getElementById("aviso");
function avisar(texto) {
  aviso.textContent = texto;
  aviso.hidden = !texto;
}

async function conferir() {
  if (!codigo) return t.linkIncompleto;
  try {
    const resposta = await fetch(`/sala?codigo=${encodeURIComponent(codigo)}`);
    if (resposta.status === 403) return t.codigoErrado;
    if (resposta.status === 503) return t.semMesa;
    if (!resposta.ok) return t.respostaEstranha;
    return null;
  } catch {
    return t.semRede;
  }
}

// O código vai para o kit ler os estilos de medidor dos plugins.
const kit = document.createElement("iframe");
kit.src = `/kit/retratos?code=${encodeURIComponent(codigo)}${personagem ? "&encaixar=1" : ""}`;
kit.setAttribute("allowtransparency", "true");
document.body.append(kit);

let pronto = false;
const pendentes = new Map();
function pedir(tipo, valor) {
  if (pronto) kit.contentWindow.postMessage({ ato20: "retratos", [tipo]: valor }, "*");
  else pendentes.set(tipo, valor);
}
addEventListener("message", (evento) => {
  if (evento.source !== kit.contentWindow || evento.data?.ato20 !== "retratos" || !evento.data.pronto) return;
  pronto = true;
  for (const [tipo, valor] of pendentes) pedir(tipo, valor);
  pendentes.clear();
});

// O dado que já estava na bandeja quando a fonte abriu não cai: recarregar a
// fonte no meio da sessão faria chover na live a jogada de meio minuto atrás.
let linhaDeBase = null;
let ultimoRetrato = "";
let ultimasRolagens = "";

function receber(pacote) {
  const retratos = personagem
    ? [pacote?.cards?.[personagem]].filter(Boolean)
    : Array.isArray(pacote?.grupo)
      ? pacote.grupo
      : [];
  const texto = JSON.stringify(retratos);
  if (texto !== ultimoRetrato) {
    ultimoRetrato = texto;
    pedir("mostrar", retratos);
  }

  const todas = Array.isArray(pacote?.rolagens) ? pacote.rolagens : [];
  if (linhaDeBase === null) linhaDeBase = new Set(todas.map((rolagem) => rolagem.id));
  const rolagens = todas.filter(
    (rolagem) => !linhaDeBase.has(rolagem.id) && (!personagem || rolagem.personagemId === personagem),
  );
  const textoDasRolagens = JSON.stringify(rolagens);
  if (textoDasRolagens !== ultimasRolagens) {
    ultimasRolagens = textoDasRolagens;
    pedir("rolagens", rolagens);
  }

  if (personagem && retratos.length === 0) {
    avisar(t.semRetrato);
  } else {
    avisar("");
  }
}

const erro = await conferir();
if (erro) {
  avisar(erro);
} else {
  const fonte = new EventSource(`/sala/plugin/${plugin}/retratos?codigo=${encodeURIComponent(codigo)}`);
  fonte.onmessage = (evento) => {
    try {
      receber(JSON.parse(evento.data));
    } catch {
      // Pacote truncado: o próximo chega na próxima mudança.
    }
  };
  fonte.onerror = () => {
    if (fonte.readyState === EventSource.CLOSED) {
      avisar(t.desligado);
    }
  };
}
