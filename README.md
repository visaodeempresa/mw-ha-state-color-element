<!-- MW-BRAND:BEGIN — gerado por IA/tools/mw-brand.sh · não editar à mão -->
<p align="center">
  <a href="https://github.com/visaodeempresa">
    <img src="https://mayconsoftware.github.io/assets/ve/LOGO_VISAO_DE_EMPRESA_HEIGHT-64px.png" alt="Visão de Empresa — MAYCON WILLIAN OLIVEIRA" height="64">
  </a>
  <br>
  <sub><b>Visão de Empresa</b> · componente de Home Assistant por MAYCON WILLIAN OLIVEIRA</sub>
</p>
<!-- MW-BRAND:END -->

# MW State Color Element

`custom:mw-state-color-element` — **a área da planta pintada pela leitura**.

Elemento de `picture-elements`: um retângulo sobre a planta baixa que muda de
cor conforme uma entidade e escreve o valor por cima. Serve para mapa de
temperatura, de umidade, de CO₂, de presença, de iluminância — qualquer
grandeza que faça sentido ler *pelo cômodo* em vez de por uma lista de números.

<sub>Não confunda com um card: elemento entra na lista `elements:` de um
`type: picture-elements`, não no seletor de cards.</sub>

## Por que ele existe

Antes, cada retângulo de uma planta térmica era um `custom:button-card` com um
`template:` e ~35 linhas de `styles:` repetidas — e a escala de cor era um
`[[[ if (temp <= 3.99) return "rgba(0,0,0,0.50)" … ]]]` de 20 linhas copiado
dentro do dashboard. Trinta áreas, trinta cópias. Trocar uma faixa de cor
significava reeditar as trinta.

```yaml
# antes — 41 linhas por área
- type: custom:button-card
  template: umid_sensor_style
  entity: sensor.umidade_da_cozinha
  title: 🟨💧 Umidade da Cozinha
  show_name: false
  show_icon: false
  style: {left: 29%, top: 7%, width: 33%, height: 100%, border-radius: 0%, box-shadow: none}
  styles:
    card: [{box-shadow: none}, {border: none}, {height: calc(12%)}, {border-radius: 0%}]
    icon: [{--mdc-icon-size: 4vh}, {transform: 'translate(0%, 5%)'}]
    state: [{transform: rotate(0deg) translateY(0%)}, {display: inline-block},
            {white-space: nowrap}, {width: 50px}]

# depois — 8 linhas, e a escala mora no componente
- type: custom:mw-state-color-element
  entity: sensor.umidade_da_cozinha
  preset: humidity
  title: 🟨💧 Umidade da Cozinha
  left: 29%
  top: 7%
  width: 33%
  height: 12%
```

## Escalas prontas (`preset:`)

| preset | grandeza | faixas | fonte |
|---|---|---|---|
| `temperature` | °C | 19 faixas, alfa 0,50 | escala canônica da casa (regra 40) |
| `humidity` | % UR | 101 faixas, alfa 0,50 | idem |
| `co2` | ppm | 350 / 800 / 1200 | escala de qualidade do ar (regra 90) |
| `tvoc` | ppm | 0 / 0,3 / 0,6 | idem |
| `hcho` | mg/m³ | 0 / 0,08 / 0,1 | idem |
| `pm25` | µg/m³ | 0 / 12 / 35 | idem |
| `lux` | lx | escuro → sol, 7 degraus | escala de iluminância |
| `battery` | % | 10 / 20 / 40 / 60 | vermelho → verde |
| `presence` | movimento + ocupação | ocupado / movimento / livre / sensores mudos | porte do `presenca_sensor_style` |
| `binary` | `on`/`off` | duas cores | — |
| `custom` | qualquer | `stops` + `colors` do YAML | você |
| `none` | — | cor fixa | — |
| `auto` (padrão) | pelo `device_class` | cai num dos de cima | — |

As faixas de temperatura, umidade e qualidade do ar **não são invenção deste
componente**: são as mesmas que os dashboards da casa já usavam, agora num
lugar só. Um gauge nativo e uma área nossa na mesma tela não discordam.

`mode: gradient` troca os degraus por interpolação contínua entre as cores da
mesma tabela — útil em mapa térmico grande, onde o degrau vira listra.

## Uso

```yaml
type: picture-elements
image: /local/assets/PLANTA.png
elements:
  # temperatura, com o texto girado 90° (cômodo mais alto que largo)
  - type: custom:mw-state-color-element
    entity: sensor.temperatura_da_sala_de_tv
    preset: temperature
    title: 🟧📺🌡️ Temperatura da Sala de TV
    left: 44%
    top: 30.5%
    width: 27%
    height: 21%
    text_rotate: 90

  # CO₂ com borda, para destacar o único cômodo que tem o sensor
  - type: custom:mw-state-color-element
    entity: sensor.qualidade_do_ar_do_escritorio_dioxido_de_carbono
    preset: co2
    left: 44%
    top: 42%
    width: 31%
    height: 16%
    border: 2

  # presença: vários sensores numa área só, ocupação vencendo movimento
  - type: custom:mw-state-color-element
    preset: presence
    title: 🟧 SALA — presença
    occupancy_entities:
      - binary_sensor.ocupacao_humana_na_sala_de_tv
    motion_entities:
      - binary_sensor.movimento_na_sala
    left: 44%
    top: 20%
    width: 27%
    height: 31%

  # escala própria: ruído em dB
  - type: custom:mw-state-color-element
    entity: sensor.ruido_da_sala
    preset: custom
    stops: [35, 55, 70]
    colors: ["#43a047", "#ffa600", "#db4437", "#7b1fa2"]
    unit: dB
    left: 10%
    top: 10%
    width: 20%
    height: 10%
```

Mais exemplos em [`examples/`](examples/).

## Opções

### Leitura
| chave | padrão | o que faz |
|---|---|---|
| `entity` | — | a entidade. Obrigatória, exceto em `presence` e `none` |
| `attribute` | — | pinta por um atributo em vez do `state` |
| `preset` | `auto` | a escala (tabela acima) |
| `name` | — | tooltip; vazio cai no `title`, depois no `friendly_name` |
| `title` | — | rótulo na **lista do editor** — não aparece na planta |

### Geometria
| chave | padrão | o que faz |
|---|---|---|
| `left` `top` `width` `height` | — | em `%` da imagem; vencem o `style:` do YAML |
| `anchor` | `center` | **a que ponto da área** `left`/`top` se referem — 9 valores (abaixo) |
| `rotate` | — | gira a área inteira |
| `radius` | — | canto arredondado (`6px`, `50%`…) |
| `z_index` | — | quem fica por cima de quem |

#### `anchor` — onde a coordenada pega a área

O `picture-elements` do Home Assistant aplica `transform: translate(-50%, -50%)`
em **todo** elemento (é o `.element` do CSS do card). Ou seja: na convenção
nativa do HA, `left`/`top` são o **centro** do objeto, não o canto. Quem não
escreve `transform` herda isso sem perceber.

Até a v0.1.0 o padrão declarado aqui era `top-left`, mas ele não escrevia
`transform` nenhum — o CSS do card vencia e a área saía **centrada** na
coordenada, meia largura à esquerda e meia altura acima do que o YAML dizia.
Da v0.2.0 em diante o `transform` é sempre escrito: o padrão passa a ser
`center` (nada muda no que já estava no ar, e é a mesma convenção do HA) e
`top-left` finalmente faz o que promete.

| valor | `left`/`top` marcam |
|---|---|
| `center` (padrão) | o centro da área — igual ao HA |
| `top-left` | o canto superior esquerdo |
| `top` · `bottom` | o meio de cima · o meio de baixo |
| `left` · `right` | o meio da esquerda · o meio da direita |
| `top-right` · `bottom-left` · `bottom-right` | os outros três cantos |

Convertendo à mão de uma convenção para a outra:

```
# retângulo desenhado pelo canto, escrito na convenção do centro
left_centro = left_canto + largura / 2
top_centro  = top_canto  + altura  / 2
```

### Pintura
| chave | padrão | o que faz |
|---|---|---|
| `alpha` | do preset | opacidade da cor (a planta está por baixo) |
| `mode` | `step` | `gradient` interpola entre as cores da tabela |
| `border` / `border_color` | `0` | borda; sem cor, usa a própria cor mais firme |
| `fade` | `0.6` | segundos de transição quando a cor muda |
| `color_unavailable` / `color_unknown` | preto 30 % | sem leitura tem cor própria — não é verde |
| `hide_unavailable` | `false` | sumir em vez de pintar de cinza |
| `stops` `colors` `clamp` | — | a escala, quando `preset: custom` |
| `color_on` `color_off` `invert` | — | quando `preset: binary` |
| `color_occupied` `color_motion` `color_clear` `color_broken` | — | quando `preset: presence` |

### Texto
| chave | padrão | o que faz |
|---|---|---|
| `show_value` | do preset | escreve o valor no meio da área |
| `decimals` | `display_precision` da entidade, senão o do preset | casas decimais |
| `unit` | da entidade | `none` esconde a unidade |
| `prefix` `suffix` `label` | — | `label` troca o valor por um texto fixo |
| `text_rotate` | `0` | `90`, `-90` ou `180` — cômodo alto e estreito |
| `text_offset` | `0%` | empurra o texto depois de girar |
| `font_size` `font_weight` `text_color` | `14px` / `bold` / tema | — |
| `text_shadow` | `false` | contorno escuro, para área clara |
| `text_when_unavailable` | `—` | o que escrever sem leitura (`""` some) |

### Ações
`tap_action`, `hold_action`, `double_tap_action` — `more-info` (padrão),
`toggle`, `navigate`, `url`, `perform-action`, `none`.

## Desempenho

Numa planta com 30 áreas, o Home Assistant entrega um objeto `hass` novo a
cada mudança de **qualquer** entidade da casa — na BASE-ALFA-01 isso é
1,3 a 1,6 mil eventos por minuto. Sem cuidado, seriam 45 mil repinturas por
minuto e a tela engasga.

Este elemento compara a **referência** do objeto de estado de cada entidade
vigiada e sai em O(1) quando nada dela mudou. A árvore do shadow DOM é montada
uma vez; a mudança de estado só troca uma custom property e o texto. A
transição de cor é `background-color` com `transition` — e some inteira sob
`prefers-reduced-motion`.

## Instalação

Pelo HACS, como repositório personalizado (categoria **Dashboard**):

```
https://github.com/visaodeempresa/mw-ha-state-color-element
```

Depois, o recurso Lovelace:

```
/hacsfiles/mw-ha-state-color-element/mw-state-color-element.js   (JavaScript Module)
```

## Verificação

```bash
node --check dist/mw-state-color-element.js
node tools/probe.js        # 58 verificações, sem navegador
```

## Ideias que ficaram para depois

Em [`BACKLOG.md`](BACKLOG.md).

## Licença

MIT © MAYCON WILLIAN OLIVEIRA
