# Backlog de melhoria — MW State Color Element

Ideias que apareceram durante a construção da v0.1.0 e **não** entraram, para
não inchar o primeiro corte. Ordenado por quanto resolvem de dor real.

## 1. Legenda automática (`mw-state-color-legend-element`)

Hoje a planta pintada não diz o que as cores significam: quem não convive com
a casa lê laranja e não sabe se é 27 °C ou 34 °C. Um elemento irmão que
desenhe a régua da escala em uso (as mesmas `stops`/`colors`, na horizontal ou
vertical, com 3–5 rótulos) fecha a leitura.
**Cuidado:** tem de ler a escala do mesmo lugar que o elemento, senão viram
duas verdades — é o problema que a regra 40 existe para evitar.

## 2. Piscar quando a leitura é ruim (`pulse_when: bad`)

CO₂ acima de 1200 ppm é a única leitura desta família que pede ação imediata.
Uma pulsação de `opacity` (composição pura, sem layout) chamaria o olho.
**Cuidado:** só faz sentido em uma ou duas áreas; a planta inteira piscando
vira ruído. E tem de respeitar `prefers-reduced-motion`, como as animações do
`mw-occupancy-motion-element`.

## 3. Média de várias entidades numa área só

Vários cômodos têm dois sensores (leste/oeste do escritório, sofá/TV da sala).
Hoje cada um vira um retângulo. `entities: [a, b]` + `aggregate: mean | max |
min` pintaria a área inteira com uma leitura só.
**Cuidado:** média de sensores com escalas ou unidades diferentes é mentira;
validar unidade antes de somar.

## 4. Interpolação espacial (mapa de calor de verdade)

O passo seguinte do degradê: em vez de retângulos com cor chapada, um SVG com
gradiente entre os pontos de medição — a planta vira mapa térmico contínuo.
**Cuidado:** é outro componente, não uma opção deste. E é caro: só vale se
puder desenhar num `<canvas>` fora do caminho de repintura do HA.

## 5. `state_map` — texto por estado

Para entidade textual (`sensor.purificador_de_ar_da_sala_qualidade_do_ar`
devolve `great`, `good`, `mild`…): mapear estado → cor **e** → texto em pt-BR.
Hoje isso se resolve com `preset: custom` só na cor; o texto sai em inglês.

## 6. Escala de PM10 e de ruído (dB)

A regra 90 cobre PM2.5, não PM10. E a casa **não tem sensor de dB** (registrado
na memória do MW Top Buttons Pack) — quando tiver, a faixa entra aqui, mas a
escala nova precisa ir para `IA/knowledge/` antes, como a de iluminância foi.

## 7. Modo "só borda"

Pintar apenas o contorno da área, deixando a planta 100 % visível por dentro.
Útil para sobrepor duas grandezas na mesma planta (uma no preenchimento, outra
na borda) — hoje é preciso empilhar dois elementos com `alpha: 0`.

## 8. Escala compartilhada por dashboard

`preset: ref:minha_escala`, lendo uma definição declarada uma vez na view.
Evita repetir `stops`/`colors` em vinte áreas quando a escala é custom.
**Cuidado:** picture-elements não tem escopo de view; precisaria de um registro
no `window`, com todos os problemas de ordem de carga que isso traz.

## 9. Publicar no HACS por padrão (repositório destaque)

Hoje entra como repositório personalizado. Pedido de inclusão na lista padrão
do HACS exige README em inglês, `hacs.json` com `homeassistant` mínimo e
release estável — vale a pena quando a v1 estabilizar.
