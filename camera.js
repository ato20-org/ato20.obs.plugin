// A câmera dos dados: roda no navegador do OBS, não no Mestre.
//
// Assina o canal que main.js publica, decide o que cai e quando sai, e pede ao
// kit de dados do ATO20 (/kit/dados, num iframe) que desenhe. O kit só desenha;
// o que aparece é decisão daqui.
//
// A página vem numa origem opaca (sandbox): sem localStorage, sem cookie. O
// que ela sabe da mesa é o que o plugin publicou.

const busca = new URLSearchParams(location.search);
const codigo = (busca.get("code") ?? "").trim().toUpperCase();
const quem = busca.get("quem") || null;
const escala = busca.get("escala") ?? "1";
// /plugin/{id}/camera.html: o id vem do caminho, e não escrito aqui.
const plugin = location.pathname.split("/")[2];

const aviso = document.getElementById("aviso");
function avisar(texto) {
  aviso.textContent = texto;
  aviso.hidden = !texto;
}

async function conferir() {
  if (!codigo) return "Link incompleto. Copie o link do painel Transmissão, no Mestre.";
  try {
    const resposta = await fetch(`/sala?codigo=${encodeURIComponent(codigo)}`);
    if (resposta.status === 403) return "O código da mesa não confere.";
    if (resposta.status === 503) return "O mestre ainda não abriu uma campanha.";
    if (!resposta.ok) return "A mesa respondeu de um jeito inesperado.";
    return null;
  } catch {
    return "Não foi possível alcançar a mesa. Confira a rede e o endereço.";
  }
}

// O kit, e o que foi pedido antes de ele dizer que está pronto.
const kit = document.createElement("iframe");
kit.src = `/kit/dados?escala=${encodeURIComponent(escala)}`;
kit.setAttribute("allowtransparency", "true");
document.body.append(kit);

let pronto = false;
const fila = [];
function pedir(mensagem) {
  if (pronto) kit.contentWindow.postMessage({ ato20: "dados", ...mensagem }, "*");
  else fila.push(mensagem);
}
addEventListener("message", (evento) => {
  if (evento.source !== kit.contentWindow || evento.data?.ato20 !== "dados" || !evento.data.pronto) return;
  pronto = true;
  for (const mensagem of fila.splice(0)) pedir(mensagem);
});

// O que já está na mesa quando a fonte abre não cai: recarregar a fonte no
// meio da sessão faria chover na live cada dado deixado ali.
let vistos = null;
const naTela = new Set();

function receber(pacote) {
  const dados = Array.isArray(pacote?.dados) ? pacote.dados : [];
  const agora = new Set(dados.map((dado) => dado.id));

  if (vistos === null) {
    vistos = agora;
    return;
  }

  const novos = dados.filter((dado) => !vistos.has(dado.id) && (quem === null || dado.quem === quem));
  if (novos.length > 0) {
    pedir({
      lancar: novos.map((dado) => ({
        id: dado.id,
        faces: dado.faces,
        face: dado.face,
        semente: dado.semente,
        impulso: dado.impulso,
        rotulo: pacote.nome ? dado.nome : undefined,
        prazo: pacote.prazo,
      })),
    });
    for (const dado of novos) naTela.add(dado.id);
  }

  // Saiu da mesa (recolhido, bandeja vencida, pessoa desligada): sai da live.
  const sairam = [...naTela].filter((id) => !agora.has(id));
  if (sairam.length > 0) {
    pedir({ tirar: sairam });
    for (const id of sairam) naTela.delete(id);
  }

  vistos = agora;
}

const erro = await conferir();
if (erro) {
  avisar(erro);
} else {
  const fonte = new EventSource(`/sala/plugin/${plugin}/dados?codigo=${encodeURIComponent(codigo)}`);
  fonte.onmessage = (evento) => {
    try {
      receber(JSON.parse(evento.data));
    } catch {
      // Pacote truncado: o próximo chega na próxima rolagem.
    }
  };
  fonte.onerror = () => {
    // O EventSource reconecta sozinho. Se o plugin foi desligado, o canal
    // responde 404 e ele desiste: o recado diz o que conferir.
    if (fonte.readyState === EventSource.CLOSED) {
      avisar("O plugin OBS está desligado no Mestre, ou a mesa fechou.");
    }
  };
}
