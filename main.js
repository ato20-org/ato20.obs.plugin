// Plugin OBS para o ATO20.
//
// Roda no Mestre. Faz quatro coisas:
//   1. escuta a mesa (api.dados.assinarMesa) e publica no canal "dados" só o
//      que pode ir para a live: dado da mesa do mapa, de quem está ligado;
//   2. publica no canal "retratos" os retratos no ar (o grupo), um card por
//      personagem de jogador, e os dados que caem embaixo de cada um;
//   3. desenha o painel Transmissão, com os links e os interruptores;
//   4. guarda quem fica de fora na configuração "obs.ocultos", da campanha.
//
// Quem desenha na live são camera.html e retratos.html, que rodam no
// navegador do OBS.

const MESTRE = "mestre";
const CANAL = "dados";
const CANAL_DOS_RETRATOS = "retratos";

// O texto do painel e o que vai para a live, no idioma do Mestre
// (`api.idioma`, API 7). As páginas recebem o idioma pelo link.
const TEXTOS = {
  "pt-BR": {
    mestre: "Mestre",
    personagem: "Personagem",
    semCampanhaLink: "Abra uma campanha para ter o link.",
    semCampanhaLinks: "Abra uma campanha para ter os links.",
    copiado: "Link copiado",
    naoCopiou: (link) => `Não foi possível copiar: ${link}`,
    notaDoMestre: "Seus dados só saem desta máquina com isto ligado.",
    daqui: "Transmite daqui",
    deOutro: "De outro computador",
    notaDaRede: "Pelo Wi-Fi. Quem tem o código da mesa também consegue abrir estes links.",
    notaDaqui: "Só funciona no OBS desta máquina.",
    camera: "Câmera dos dados",
    notaDaCamera: "Todos que estão ligados, numa fonte só.",
    copiarCamera: "Copiar o link da câmera dos dados",
    aparece: (nome) => `${nome} aparece na live`,
    copiarDadosDe: (nome) => `Copiar o link só com os dados de ${nome}`,
    retratos: "Retratos",
    notaDosRetratos:
      "O grupo segue o que está no ar na mesa. O card de cada personagem aparece mesmo fora da janela do espectador, com o dado embaixo.",
    copiarRetratos: "Copiar o link dos retratos no ar",
    semPjs: "Nenhum personagem vinculado a jogador ainda.",
    copiarCardDe: (nome) => `Copiar o link do card de ${nome}`,
    comoUsar:
      "No OBS: Fontes, +, Navegador, e cole o link. O fundo é transparente. O grupo fica certo numa fonte 16:9, como a janela do espectador. Na câmera dos dados, numa caixa pequena, acrescente &escala=2 ao link para o dado ficar maior.",
  },
  en: {
    mestre: "GM",
    personagem: "Character",
    semCampanhaLink: "Open a campaign to get the link.",
    semCampanhaLinks: "Open a campaign to get the links.",
    copiado: "Link copied",
    naoCopiou: (link) => `Could not copy: ${link}`,
    notaDoMestre: "Your dice only leave this machine with this on.",
    daqui: "Streaming from here",
    deOutro: "From another computer",
    notaDaRede: "Over Wi-Fi. Anyone with the table code can open these links too.",
    notaDaqui: "Only works in OBS on this machine.",
    camera: "Dice camera",
    notaDaCamera: "Everyone who is on, in a single source.",
    copiarCamera: "Copy the dice camera link",
    aparece: (nome) => `${nome} shows on stream`,
    copiarDadosDe: (nome) => `Copy the link with only ${nome}'s dice`,
    retratos: "Portraits",
    notaDosRetratos:
      "The group follows what is on air at the table. Each character's card shows even outside the spectator window, with the die below.",
    copiarRetratos: "Copy the on-air portraits link",
    semPjs: "No character linked to a player yet.",
    copiarCardDe: (nome) => `Copy ${nome}'s card link`,
    comoUsar:
      "In OBS: Sources, +, Browser, and paste the link. The background is transparent. The group fits a 16:9 source, like the spectator window. For the dice camera in a small box, add &escala=2 to the link to make the die bigger.",
  },
};

const plugin = {
  ativar(api) {
    const texto = TEXTOS[api.idioma === "en" ? "en" : "pt-BR"];
    const h = api.react.createElement;
    const { useEffect, useState } = api.react;
    const { Button, Switch, ScrollArea, PainelVazio } = api.ui.componentes;
    const Copiar = api.ui.icones.copiar;

    const ocultos = () => {
      const valor = api.config.ler("obs.ocultos");
      return Array.isArray(valor) ? valor : [MESTRE];
    };
    const quemJogou = (dado) => (dado.origem === "jogador" ? dado.jogadorId : MESTRE);

    // O filtro mora AQUI, antes de publicar: o dado de quem está desligado
    // nem sai do Mestre. Quem tem o código da mesa consegue abrir o canal.
    function publicar(dados = api.dados.naMesa()) {
      const fora = new Set(ocultos());

      api.mesa.publicar(CANAL, {
        prazo: api.config.ler("obs.prazo") ?? 10,
        nome: api.config.ler("obs.nome") === true,
        dados: dados
          // O quadro é a bancada do mestre: dado de preparação não vai para a live.
          .filter((dado) => dado.mesa === "mapa" && !fora.has(quemJogou(dado)))
          .map((dado) => ({
            id: dado.id,
            quem: quemJogou(dado),
            nome: dado.origem === "jogador" ? dado.jogador : texto.mestre,
            faces: dado.faces,
            face: dado.face,
            semente: dado.semente,
            impulso: dado.impulso,
          })),
      });
    }

    // Os personagens de jogador: quem ganha card. Os vínculos mudam pouco, e
    // lê-los a cada golpe de medidor seria IPC à toa.
    let pjs = [];
    async function lerPjs() {
      const jogadores = await api.jogadores.listar();
      pjs = [...new Set(jogadores.flatMap((jogador) => jogador.personagens))];
      publicarRetratos();
    }

    // O grupo é o que está no ar, como a mesa vê; o card de cada PJ existe
    // mesmo com o retrato fora da TV. Os dados embaixo seguem o mesmo
    // interruptor da câmera dos dados: quem está desligado não aparece.
    function publicarRetratos(grupo = api.retratos.naMesa()) {
      const fora = new Set(ocultos());
      const cards = {};
      for (const id of pjs) {
        const retrato = api.retratos.dePersonagem(id);
        if (retrato) cards[id] = retrato;
      }

      api.mesa.publicar(CANAL_DOS_RETRATOS, {
        grupo,
        cards,
        rolagens: api.dados
          .naMesa()
          .filter((dado) => dado.origem === "jogador" && dado.personagemId && !fora.has(dado.jogadorId))
          .map((dado) => ({
            id: dado.id,
            faces: dado.faces,
            valor: dado.face,
            personagemId: dado.personagemId,
            jogadorId: dado.jogadorId,
            jogador: dado.jogador,
          })),
      });
    }

    api.dados.assinarMesa((dados) => {
      publicar(dados);
      publicarRetratos();
    });
    api.retratos.assinarMesa(publicarRetratos);
    api.personagens.assinar(() => {
      if (pjs.length === 0) void lerPjs();
      else publicarRetratos();
    });
    for (const chave of ["obs.ocultos", "obs.prazo", "obs.nome"]) {
      api.config.assinar(chave, () => {
        publicar();
        publicarRetratos();
      });
    }
    void lerPjs();
    const relerPjs = setInterval(() => void lerPjs(), 30_000);

    function mostrar(quem, aparece) {
      const atuais = ocultos().filter((item) => item !== quem);
      api.config.gravar("obs.ocultos", aparece ? atuais : [...atuais, quem], "campanha");
    }

    function copiar(link) {
      if (!link) {
        api.ui.erro(texto.semCampanhaLink);
        return;
      }
      navigator.clipboard
        .writeText(link)
        .then(() => api.ui.aviso(texto.copiado))
        .catch(() => api.ui.erro(texto.naoCopiou(link)));
    }

    function BotaoCopiar({ link, rotulo }) {
      return h(
        Button,
        { variant: "ghost", size: "icon-sm", "aria-label": rotulo, title: link ?? "", onClick: () => copiar(link) },
        h(Copiar),
      );
    }

    function Transmissao() {
      const [rede, setRede] = useState(null);
      const [enderecos, setEnderecos] = useState(null);
      const [jogadores, setJogadores] = useState([]);
      const [fora, setFora] = useState(ocultos);
      const [links, setLinks] = useState({});

      // Quem entrou na mesa aparece na próxima leitura; a lista muda pouco.
      useEffect(() => {
        let ativo = true;
        const ler = () =>
          api.jogadores.listar().then((lista) => {
            if (ativo) setJogadores(lista);
          });
        void ler();
        void api.mesa.enderecos().then((lido) => {
          if (ativo) setEnderecos(lido);
        });
        const relogio = setInterval(ler, 30_000);
        const parar = api.config.assinar("obs.ocultos", () => setFora(ocultos()));
        return () => {
          ativo = false;
          clearInterval(relogio);
          parar();
        };
      }, []);

      // Outro computador por padrão, quando há rede: é o caso em que colar o
      // endereço errado não funciona.
      const pelaRede = rede ?? Boolean(enderecos?.rede);
      const pessoas = [
        { quem: MESTRE, nome: texto.mestre, nota: texto.notaDoMestre },
        ...jogadores.map((jogador) => ({ quem: jogador.id, nome: jogador.nome, nota: null })),
      ];
      const chaveDasPessoas = pessoas.map((pessoa) => pessoa.quem).join("|");
      const personagensDeJogador = [
        ...new Set(jogadores.flatMap((jogador) => jogador.personagens ?? [])),
      ].map((id) => ({ id, nome: api.personagens.obter(id)?.nome ?? texto.personagem }));
      const chaveDosPjs = personagensDeJogador.map((pj) => pj.id).join("|");

      // Montados antes do clique: copiar logo depois de um `await` perde a
      // permissão da área de transferência em algumas webviews.
      useEffect(() => {
        let ativo = true;
        const dados = [null, ...chaveDasPessoas.split("|")].map((quem) => ({
          chave: quem ?? "",
          pedido: api.mesa.linkDaPagina("camera", {
            rede: pelaRede,
            busca: quem ? { quem, idioma: api.idioma } : { idioma: api.idioma },
          }),
        }));
        const retratos = [null, ...(chaveDosPjs ? chaveDosPjs.split("|") : [])].map((id) => ({
          chave: `retratos:${id ?? "grupo"}`,
          pedido: api.mesa.linkDaPagina("retratos", {
            rede: pelaRede,
            busca: id ? { personagem: id, idioma: api.idioma } : { modo: "grupo", idioma: api.idioma },
          }),
        }));
        const todos = [...dados, ...retratos];
        void Promise.all(todos.map((item) => item.pedido)).then((lidos) => {
          if (!ativo) return;
          setLinks(Object.fromEntries(todos.map((item, i) => [item.chave, lidos[i]])));
        });
        return () => {
          ativo = false;
        };
      }, [pelaRede, chaveDasPessoas, chaveDosPjs, enderecos?.codigo]);

      if (enderecos && !enderecos.codigo) {
        return h(PainelVazio, { icone: api.ui.icones.mesa }, texto.semCampanhaLinks);
      }

      return h(
        ScrollArea,
        { className: "min-h-0 flex-1" },
        h(
          "div",
          { className: "space-y-4 p-3" },
          h(
            "div",
            { className: "space-y-1.5" },
            h(
              "div",
              { style: { display: "flex", gap: 4 } },
              h(
                Button,
                { size: "sm", variant: pelaRede ? "ghost" : "secondary", onClick: () => setRede(false) },
                texto.daqui,
              ),
              h(
                Button,
                {
                  size: "sm",
                  variant: pelaRede ? "secondary" : "ghost",
                  disabled: !enderecos?.rede,
                  onClick: () => setRede(true),
                },
                texto.deOutro,
              ),
            ),
            h(
              "p",
              { className: "text-muted-foreground text-[11px] leading-snug" },
              pelaRede
                ? texto.notaDaRede
                : texto.notaDaqui,
            ),
          ),
          h(
            "section",
            { className: "space-y-2" },
            h(
              "div",
              { className: "flex items-center gap-2" },
              h(
                "div",
                { className: "min-w-0 flex-1" },
                h("h3", { className: "truncate text-sm font-medium" }, texto.camera),
                h(
                  "p",
                  { className: "text-muted-foreground text-[11px] leading-snug" },
                  texto.notaDaCamera,
                ),
              ),
              h(BotaoCopiar, { link: links[""], rotulo: texto.copiarCamera }),
            ),
            h(
              "ul",
              { className: "divide-y" },
              pessoas.map((pessoa) => {
                const aparece = !fora.includes(pessoa.quem);
                return h(
                  "li",
                  { key: pessoa.quem, className: "flex items-center gap-3 py-2" },
                  h(Switch, {
                    checked: aparece,
                    onCheckedChange: (ligado) => mostrar(pessoa.quem, ligado),
                    "aria-label": texto.aparece(pessoa.nome),
                  }),
                  h(
                    "span",
                    { className: "min-w-0 flex-1" },
                    h(
                      "span",
                      { className: aparece ? "block truncate text-sm" : "text-muted-foreground block truncate text-sm" },
                      pessoa.nome,
                    ),
                    pessoa.nota
                      ? h("span", { className: "text-muted-foreground block text-[11px] leading-snug" }, pessoa.nota)
                      : null,
                  ),
                  h(BotaoCopiar, {
                    link: links[pessoa.quem],
                    rotulo: texto.copiarDadosDe(pessoa.nome),
                  }),
                );
              }),
            ),
          ),
          h(
            "section",
            { className: "space-y-2" },
            h(
              "div",
              { className: "flex items-center gap-2" },
              h(
                "div",
                { className: "min-w-0 flex-1" },
                h("h3", { className: "truncate text-sm font-medium" }, texto.retratos),
                h(
                  "p",
                  { className: "text-muted-foreground text-[11px] leading-snug" },
                  texto.notaDosRetratos,
                ),
              ),
              h(BotaoCopiar, { link: links["retratos:grupo"], rotulo: texto.copiarRetratos }),
            ),
            personagensDeJogador.length === 0
              ? h(
                  "p",
                  { className: "text-muted-foreground text-[11px] leading-snug" },
                  texto.semPjs,
                )
              : h(
                  "ul",
                  { className: "divide-y" },
                  personagensDeJogador.map((pj) =>
                    h(
                      "li",
                      { key: pj.id, className: "flex items-center gap-3 py-2" },
                      h("span", { className: "min-w-0 flex-1 truncate text-sm" }, pj.nome),
                      h(BotaoCopiar, {
                        link: links[`retratos:${pj.id}`],
                        rotulo: texto.copiarCardDe(pj.nome),
                      }),
                    ),
                  ),
                ),
          ),
          h(
            "p",
            { className: "text-muted-foreground text-[11px] leading-snug" },
            texto.comoUsar,
          ),
        ),
      );
    }

    api.registrar.painel({ id: "transmissao", corpo: Transmissao });

    // O que o aplicativo desfaz sozinho ao desligar é o que passou por `api`;
    // o relógio é daqui.
    return () => clearInterval(relerPjs);
  },
};

export default plugin;
