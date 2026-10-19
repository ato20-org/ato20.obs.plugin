// Os textos do plugin, em português e em inglês.
//
// Um arquivo só para o painel e para as páginas: main.js o importa pelo
// protocolo do Mestre, e camera.js e retratos.js pelo daemon, que serve a
// pasta inteira. O painel escolhe por `api.idioma`; as páginas, pelo
// `idioma` que o painel põe no link -- elas rodam no OBS e não sabem em que
// língua está o Mestre. Link sem `idioma` é português, como sempre foi.

const TEXTOS = {
  "pt-BR": {
    mestre: "Mestre",
    personagem: "Personagem",
    semCampanhaLink: "Abra uma campanha para ter o link.",
    semCampanhaLinks: "Abra uma campanha para ter os links.",
    copiado: "Link copiado",
    naoCopiou: (link) => `Não foi possível copiar: ${link}`,
    notaDoMestre: "Seus dados só saem desta máquina com isto ligado.",
    transmiteDaqui: "Transmite daqui",
    deOutroComputador: "De outro computador",
    pelaRede: "Pela rede do convite, o Wi-Fi ou a VPN. Quem tem o código da mesa também consegue abrir estes links.",
    soDaqui: "Só funciona no OBS desta máquina.",
    camera: "Câmera dos dados",
    cameraNota: "Todos que estão ligados, numa fonte só.",
    copiarCamera: "Copiar o link da câmera dos dados",
    aparece: (nome) => `${nome} aparece na live`,
    copiarDadosDe: (nome) => `Copiar o link só com os dados de ${nome}`,
    retratos: "Retratos",
    retratosNota:
      "O grupo segue o que está no ar na mesa. O card de cada personagem aparece mesmo fora da TV, com o dado embaixo.",
    copiarRetratos: "Copiar o link dos retratos no ar",
    semPjs: "Nenhum personagem vinculado a jogador ainda.",
    copiarCard: (nome) => `Copiar o link do card de ${nome}`,
    comoUsar:
      "No OBS: Fontes, +, Navegador, e cole o link. O fundo é transparente. O grupo fica certo numa fonte 16:9, como a TV. Na câmera dos dados, numa caixa pequena, acrescente &escala=2 ao link para o dado ficar maior.",

    linkIncompleto: "Link incompleto. Copie o link do painel Transmissão, no Mestre.",
    codigoErrado: "O código da mesa não confere.",
    semMesa: "O mestre ainda não abriu uma campanha.",
    respostaEstranha: "A mesa respondeu de um jeito inesperado.",
    semRede: "Não foi possível alcançar a mesa. Confira a rede e o endereço.",
    desligado: "O plugin OBS está desligado no Mestre, ou a mesa fechou.",
    semRetrato: "Este personagem não tem Retrato na ficha, ou não está mais vinculado a um jogador.",
  },
  en: {
    mestre: "GM",
    personagem: "Character",
    semCampanhaLink: "Open a campaign to get the link.",
    semCampanhaLinks: "Open a campaign to get the links.",
    copiado: "Link copied",
    naoCopiou: (link) => `Could not copy: ${link}`,
    notaDoMestre: "Your dice only leave this machine with this on.",
    transmiteDaqui: "Stream from here",
    deOutroComputador: "From another computer",
    pelaRede: "Over the invite's network, Wi-Fi or VPN. Anyone with the table code can also open these links.",
    soDaqui: "Only works in OBS on this machine.",
    camera: "Dice camera",
    cameraNota: "Everyone who is on, in a single source.",
    copiarCamera: "Copy the dice camera link",
    aparece: (nome) => `${nome} shows on stream`,
    copiarDadosDe: (nome) => `Copy the link with only ${nome}'s dice`,
    retratos: "Portraits",
    retratosNota:
      "The group follows what is on air at the table. Each character's card shows even off the TV, with their die below.",
    copiarRetratos: "Copy the on-air portraits link",
    semPjs: "No character linked to a player yet.",
    copiarCard: (nome) => `Copy ${nome}'s card link`,
    comoUsar:
      "In OBS: Sources, +, Browser, and paste the link. The background is transparent. The group fits a 16:9 source, like the TV. For the dice camera in a small box, add &escala=2 to the link to make the dice bigger.",

    linkIncompleto: "Incomplete link. Copy it from the Stream panel, in the GM window.",
    codigoErrado: "The table code does not match.",
    semMesa: "The GM has not opened a campaign yet.",
    respostaEstranha: "The table answered in an unexpected way.",
    semRede: "Could not reach the table. Check the network and the address.",
    desligado: "The OBS plugin is off in the GM window, or the table closed.",
    semRetrato: "This character has no Portrait on the sheet, or is no longer linked to a player.",
  },
};

export function textosPara(idioma) {
  return TEXTOS[idioma] ?? TEXTOS["pt-BR"];
}
