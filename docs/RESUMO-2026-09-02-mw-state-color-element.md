# MW State Color Element + QUALIDADE DO AR 3.0 — o que ficou pronto

**Data:** 2026-09-02 · **Autor:** MAYCON WILLIAN OLIVEIRA

## Em uma frase

Nasceu o `custom:mw-state-color-element` (repo público, v0.1.0, instalado e
conferido no HA) e o `/qualidade-do-ar-3`, que é a mesma tela da 2.0 com os 85
retângulos de escala trocados pelo componente — e com as três plantas que o
nome do dashboard prometia e a 2.0 não tinha.

## Links

- Tela: <http://192.168.1.71:8123/qualidade-do-ar-3> ·
  <https://4zjeuyft9onj438p5ckidgwucws17x5f.ui.nabu.casa/qualidade-do-ar-3>
- Repo: <https://github.com/visaodeempresa/mw-ha-state-color-element>
- Release: v0.1.0 (auto-release na `main`)

## O que o componente faz

Elemento de `picture-elements`: um retângulo sobre a planta baixa que muda de
cor conforme uma entidade e escreve o valor por cima.

| antes (por área) | depois (por área) |
|---|---|
| 41 linhas: `custom:button-card` + `template:` + `styles:` repetidos | 8 linhas: `entity` + `preset` + geometria |
| escala de cor = 20 linhas de JS dentro do dashboard, 56 cópias | escala vem de `IA/lib/`, uma fonte só |

### As 13 escalas (`preset:`)

| preset | grandeza | de onde vieram as faixas |
|---|---|---|
| `temperature` · `humidity` | °C · %UR | escala canônica da casa — **regra global 40** |
| `co2` · `tvoc` · `hcho` · `pm25` | ppm · ppm · mg/m³ · µg/m³ | escala de qualidade do ar — **regra global 90** |
| `presence` | movimento + ocupação | porte fiel do `presenca_sensor_style` dos `home-9-0-*` |
| `lux` · `battery` | lx · % | escala nova, documentada em `IA/knowledge/escala-de-iluminancia.md` |
| `binary` | on/off | duas cores |
| `custom` | qualquer | `stops` + `colors` no YAML |
| `none` · `auto` | — | cor fixa · pelo `device_class` |

Nenhuma faixa foi inventada. `mode: gradient` troca os degraus por
interpolação contínua na mesma tabela.

## A tela

Oito plantas, na ordem: **planta cinza** (luzes/portas/sensores, intocada),
**temperatura**, **umidade**, **presença**, **CO₂ e material particulado**,
**TVOC**, **formaldeído**, **iluminância**. 108 elementos, 0 `button-card` de
escala. Cada planta ganhou cabeçalho — com oito empilhadas, "a laranja" e "a
azul" deixaram de ser nomes.

As três plantas de qualidade do ar cobrem os cômodos que **têm** sensor
(cozinha, escritório, suíte; PM2.5 é o purificador da sala). Cômodo sem sensor
não é pintado de verde — fica com a planta à mostra.

## O que foi verificado, e como

| verificação | resultado |
|---|---|
| `node tools/probe.js` | 58 verificações, verde |
| `IA/tools/check-embeds.sh` | 3 blocos canônicos embutidos batem com `IA/lib/` |
| CI do repo | verde · release **v0.1.0** publicada |
| `curl` no HA | 45 715 bytes, **byte a byte igual** ao `dist` |
| `conferir_qar3.py` | 108 elementos instanciados, 0 erros, cor e texto de cada área conferidos com os estados reais |
| **olho na tela** | as 8 plantas abertas em `/qualidade-do-ar-3`, com dois defeitos achados e corrigidos |

Os dois defeitos que só o olho pegou:

1. **Fundo rosa no formaldeído** — os três cômodos estavam verdes e a moldura
   gritava "perigo". Virou roxo escuro. Cor de fundo de seção é leitura, não
   decoração.
2. **Título invisível na iluminância** — seção amarela com o texto claro do
   tema. O cabeçalho passou a aceitar cor de texto própria.

E um terceiro que a conferência por código pegou antes: a mesma entidade de
CO₂ repetida em três retângulos vizinhos do escritório somava o alfa na
sobreposição (faixa mais escura) e escrevia "368 ppm" três vezes. Uma área,
uma leitura.

## O que entrou no harness

- `IA/lib/mw-air-quality-scale/` — a **regra 90 ganhou implementação em JS**.
  O teste roda o `escala_ar.py` de verdade e compara degrau a degrau.
- `IA/knowledge/escala-de-iluminancia.md` — grandeza nova documentada **antes**
  de virar preset, como a regra 40 manda.
- `IA/architectures/adr/0015` — um elemento com presets, não um por grandeza.
- Skill no próprio repo (`.claude/skills/mw-state-color-element/`), com as
  armadilhas e o sintoma de cada uma.
- `ha-dashboards/scripts/qualidade_ar/` — gerador + conferidor + README.
- `IA/CHANGELOG.md`, `check-embeds.sh`, `repos.tsv` do DevOps e da marca.

## Backlog de melhoria

Nove itens em [`BACKLOG.md`](../BACKLOG.md) do repo. Os três que eu faria
primeiro:

1. **Legenda automática** (`mw-state-color-legend-element`) — a planta pintada
   não diz o que a cor significa. Quem não convive com a casa vê laranja e não
   sabe se é 27 °C ou 34 °C.
2. **Média de várias entidades numa área** (`entities` + `aggregate`) — hoje o
   escritório tem três sensores de temperatura e vira três retângulos.
3. **`state_map`** — para entidade textual (o purificador da sala responde
   `great`/`good`/`mild`), mapear estado → cor **e** → texto em pt-BR.

## Pendências que dependem de você

1. **HACS**: cadastrar `https://github.com/visaodeempresa/mw-ha-state-color-element`
   como repositório personalizado (categoria Dashboard). Hoje o arquivo está no
   HA porque eu o entreguei por SSH — funciona, mas o HACS ainda não sabe que
   ele existe, e por isso não vai oferecer atualização.
2. **Segredos `HA_URL` / `HA_TOKEN`** do repositório: continuam vazios, como em
   todos os repos MW. É por isso que o job `publicar` do auto-release falhou
   (a release em si saiu). Enquanto não forem cadastrados, a entrega no HA
   continua sendo por SSH.
3. **A skill do repo está na `develop`.** Não mandei para a `main` para não
   gerar uma release só de documentação — ela sobe junto com a próxima
   mudança de código.
