// Os retratos na live: roda no navegador do OBS, não no Mestre.
//
// Dois modos, pelo link:
//   ?modo=grupo          os retratos no ar, onde a mesa os pôs (fonte 16:9)
//   ?personagem={id}     o card de um personagem, encaixado na caixa da fonte
//
// Assina o canal "retratos" que main.js publica e pede ao kit de retratos do
// ATO20 (/kit/retratos, num iframe) que desenhe -- com o dado de quem jogou
// caindo embaixo do retrato, como na TV.

const busca = new URLSearchParams(location.search);
// O idioma vem no link que o painel Transmissão copia: o navegador do OBS
// não sabe em que idioma está o Mestre.
const TEXTOS = {
  "pt-BR": {
    linkIncompleto: "Link incompleto. Copie o link do painel Transmissão, no Mestre.",
    codigoErrado: "O código da mesa não confere.",
    semCampanha: "O mestre ainda não abriu uma campanha.",
    inesperado: "A mesa respondeu de um jeito inesperado.",
    semRede: "Não foi possível alcançar a mesa. Confira a rede e o endereço.",
    desligado: "O plugin OBS está desligado no Mestre, ou a mesa fechou.",
    semRetrato: "Este personagem não tem Retrato na ficha, ou não está mais vinculado a um jogador.",
  },
  en: {
    linkIncompleto: "Incomplete link. Copy the link from the Streaming panel, on the GM screen.",
    codigoErrado: "The table code does not match.",
    semCampanha: "The GM has not opened a campaign yet.",
    inesperado: "The table answered in an unexpected way.",
    semRede: "Could not reach the table. Check the network and the address.",
    desligado: "The OBS plugin is off on the GM screen, or the table closed.",
    semRetrato: "This character has no Portrait on the sheet, or is no longer linked to a player.",
  },
};
const texto = TEXTOS[busca.get("idioma") === "en" ? "en" : "pt-BR"];
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
  if (!codigo) return texto.linkIncompleto;
  try {
    const resposta = await fetch(`/sala?codigo=${encodeURIComponent(codigo)}`);
    if (resposta.status === 403) return texto.codigoErrado;
    if (resposta.status === 503) return texto.semCampanha;
    if (!resposta.ok) return texto.inesperado;
    return null;
  } catch {
    return texto.semRede;
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
    avisar(texto.semRetrato);
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
      avisar(texto.desligado);
    }
  };
}
