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

import { textosPara } from "./textos.js";

const MESTRE = "mestre";
const CANAL = "dados";
const CANAL_DOS_RETRATOS = "retratos";

const plugin = {
  ativar(api) {
    const h = api.react.createElement;
    const t = textosPara(api.idioma);
    // As páginas rodam no OBS e não sabem a língua do Mestre: vai no link.
    const doIdioma = api.idioma === "en" ? { idioma: "en" } : {};
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
            nome: dado.origem === "jogador" ? dado.jogador : t.mestre,
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
        api.ui.erro(t.semCampanhaLink);
        return;
      }
      navigator.clipboard
        .writeText(link)
        .then(() => api.ui.aviso(t.copiado))
        .catch(() => api.ui.erro(t.naoCopiou(link)));
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
        { quem: MESTRE, nome: t.mestre, nota: t.notaDoMestre },
        ...jogadores.map((jogador) => ({ quem: jogador.id, nome: jogador.nome, nota: null })),
      ];
      const chaveDasPessoas = pessoas.map((pessoa) => pessoa.quem).join("|");
      const personagensDeJogador = [
        ...new Set(jogadores.flatMap((jogador) => jogador.personagens ?? [])),
      ].map((id) => ({ id, nome: api.personagens.obter(id)?.nome ?? t.personagem }));
      const chaveDosPjs = personagensDeJogador.map((pj) => pj.id).join("|");

      // Montados antes do clique: copiar logo depois de um `await` perde a
      // permissão da área de transferência em algumas webviews.
      useEffect(() => {
        let ativo = true;
        const dados = [null, ...chaveDasPessoas.split("|")].map((quem) => ({
          chave: quem ?? "",
          pedido: api.mesa.linkDaPagina("camera", { rede: pelaRede, busca: { ...(quem ? { quem } : {}), ...doIdioma } }),
        }));
        const retratos = [null, ...(chaveDosPjs ? chaveDosPjs.split("|") : [])].map((id) => ({
          chave: `retratos:${id ?? "grupo"}`,
          pedido: api.mesa.linkDaPagina("retratos", {
            rede: pelaRede,
            busca: { ...(id ? { personagem: id } : { modo: "grupo" }), ...doIdioma },
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
        return h(PainelVazio, { icone: api.ui.icones.mesa }, t.semCampanhaLinks);
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
                t.transmiteDaqui,
              ),
              h(
                Button,
                {
                  size: "sm",
                  variant: pelaRede ? "secondary" : "ghost",
                  disabled: !enderecos?.rede,
                  onClick: () => setRede(true),
                },
                t.deOutroComputador,
              ),
            ),
            h(
              "p",
              { className: "text-muted-foreground text-[11px] leading-snug" },
              pelaRede ? t.pelaRede : t.soDaqui,
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
                h("h3", { className: "truncate text-sm font-medium" }, t.camera),
                h(
                  "p",
                  { className: "text-muted-foreground text-[11px] leading-snug" },
                  t.cameraNota,
                ),
              ),
              h(BotaoCopiar, { link: links[""], rotulo: t.copiarCamera }),
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
                    "aria-label": t.aparece(pessoa.nome),
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
                    rotulo: t.copiarDadosDe(pessoa.nome),
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
                h("h3", { className: "truncate text-sm font-medium" }, t.retratos),
                h(
                  "p",
                  { className: "text-muted-foreground text-[11px] leading-snug" },
                  t.retratosNota,
                ),
              ),
              h(BotaoCopiar, { link: links["retratos:grupo"], rotulo: t.copiarRetratos }),
            ),
            personagensDeJogador.length === 0
              ? h(
                  "p",
                  { className: "text-muted-foreground text-[11px] leading-snug" },
                  t.semPjs,
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
                        rotulo: t.copiarCard(pj.nome),
                      }),
                    ),
                  ),
                ),
          ),
          h(
            "p",
            { className: "text-muted-foreground text-[11px] leading-snug" },
            t.comoUsar,
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
