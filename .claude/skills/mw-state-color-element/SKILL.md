---
name: mw-state-color-element
description: Mexer no elemento que pinta ÁREA da planta pelo estado — custom:mw-state-color-element. Use quando o Maycon falar em "planta térmica", "mapa de calor da casa", "pintar o cômodo pela temperatura/umidade/CO₂", "mapa de presença por área", "planta de iluminância", "quero outra escala de cor no mapa", "a área ficou cinza/sem leitura", "o número saiu cortado na área", ou quando um pedido envolver trocar os button-card de escala (temp_sensor_style / umid_sensor_style / presenca_sensor_style) por componente. Para elemento NOVO de planta, a skill é mw-picture-element; para card de view, ha-lovelace-card-factory.
---

# MW State Color Element — a área da planta pintada pelo estado

Elemento de `picture-elements`. Um retângulo sobre a planta baixa, colorido
por uma leitura, com o valor escrito por cima. Arquivo único, JS puro, sem
build. Repo público: `visaodeempresa/mw-ha-state-color-element`.

## Antes de escrever qualquer coisa

| Preciso de | Onde |
|---|---|
| escala de °C e %UR | `IA/lib/mw-climate-scale` — regra global **40** |
| escala de CO₂/TVOC/HCHO/PM | `IA/lib/mw-air-quality-scale` — regra global **90** |
| escala de lux e bateria | `IA/knowledge/escala-de-iluminancia.md` |
| identidade na lista do editor | `IA/lib/mw-element-identity` — regra global **60** |
| esteira, release, HACS | `IA/tools/mw-devops.sh` — regra global **50** |

**Nunca invente faixa nova.** Escala diferente é opção explícita
(`preset: custom` com `stops`/`colors`), nunca o padrão. Grandeza nova pede
página em `IA/knowledge/` **antes** de virar preset.

## Onde mexer

| quero | mexo em |
|---|---|
| campo novo | `DEFAULTS` + `LABELS` + `SCHEMA` (os três, sempre) |
| preset novo | `PRESETS` + `PRESET_ALIAS` + `_valueColor` + opção no `SCHEMA` |
| cor por valor | **não** aqui: em `IA/lib/`, depois `check-embeds.sh --fix` |
| texto | `_format` — número por `Intl`, unidade da entidade, `%` colado |

## Verificação (o que faz a tarefa estar pronta)

```bash
node --check dist/mw-state-color-element.js
IA/tools/check-embeds.sh                 # 3 blocos: identity, climate, air
node tools/probe.js                      # 58 verificações
# no destino, depois do deploy por SSH (runbook deploy-card-hacs-ssh.md):
curl -s http://192.168.1.71:8123/hacsfiles/mw-ha-state-color-element/mw-state-color-element.js | grep -c "<marcador novo>"
# e a prova de que a tela pinta, com os estados reais:
python3 ha-dashboards/scripts/qualidade_ar/conferir_qar3.py
```

## Armadilhas (com sintoma)

| Sintoma | Causa | Correção |
|---|---|---|
| Área toda cinza | entidade `unavailable`, ou `preset` que não bate com a grandeza | `conferir_qar3.py` diz qual; `color_unavailable` é preto 30 % de propósito |
| Número sai cortado | texto girado 90° numa caixa mais larga que alta | a planta é **retrato** (799×1451): 1 % de largura ≠ 1 % de altura. Girar só quando `altura% > largura% × 0,55 × 1,2` |
| Faixa mais escura onde dois retângulos se encostam | mesma entidade repetida em retângulos que se sobrepõem — o alfa soma | uma área, uma leitura: unir os retângulos (`uniao()` do gerador) |
| Título da seção some | fundo claro (yellow/amber) + texto claro do tema | `cor_texto` escuro no `card_mod` do heading |
| Fundo da seção contradiz a leitura | rosa/vermelho numa planta toda verde | cor de seção é semântica, não decoração |
| `livre` e `sem sensor` com a mesma cor | é fiel ao `presenca_sensor_style` original | de propósito; separar é item do BACKLOG |
| Mudei o `dist` e a tela não muda | `.js.gz` velho sendo servido | subir `.js` **e** `.js.gz`; depois ⌘⇧R |
| HACS não mostra versão nova | commit em branch | `develop` → PR → `main` dispara o auto-release |

## Fábrica do dashboard que usa isto

`ha-dashboards/scripts/qualidade_ar/` — `gerar_qar3.py` (lê a tela viva 2.0,
converte e acrescenta) e `conferir_qar3.py` (roda o elemento real com os
estados reais e diz o que cada área vai pintar). A régua é a **tela viva**,
nunca o gerador dela (regra global 130).
