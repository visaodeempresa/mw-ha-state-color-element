/* mw-ha-state-color-element — custom:mw-state-color-element
 * Elemento de picture-elements: a ÁREA da planta pintada pelo estado.
 *
 * Substitui o padrão que a casa vinha usando para pintar cômodo por leitura —
 * um `custom:button-card` com `template: temp_sensor_style` mais ~35 linhas de
 * `styles:` repetidas em cada retângulo. A escala de cor deixa de ser um
 * `[[[ if (temp <= 3.99) … ]]]` copiado em cada dashboard e passa a ser um
 * `preset:`, com as faixas canônicas da casa embutidas:
 *
 *   temperatura / umidade  → IA/lib/mw-climate-scale      (regra global 40)
 *   CO₂ / TVOC / HCHO / PM → IA/lib/mw-air-quality-scale   (regra global 90)
 *   presença / movimento   → porte do `presenca_sensor_style` dos home-9-0-*
 *   iluminância, bateria   → IA/knowledge/escala-de-iluminancia.md
 *   custom                 → `stops` + `colors` do próprio YAML
 *
 * Leveza é requisito: a árvore do shadow DOM é montada uma vez; a mudança de
 * estado só troca custom properties e o texto. `set hass` sai em O(1) quando
 * nenhuma das entidades vigiadas mudou — numa planta com 30 áreas e 1,5 mil
 * mudanças de estado por minuto, isso é a diferença entre tela viva e tela
 * travada.
 *
 * Geometria: `left`/`top` marcam o CENTRO da área (`anchor: center`), que é a
 * convenção do próprio picture-elements do HA. `anchor` aceita os 9 pontos —
 * `top-left` para quem prefere a coordenada no canto de cima.
 *
 * JS puro, arquivo único, sem build.
 * Repo: https://github.com/visaodeempresa/mw-ha-state-color-element
 * Releases automáticas: merge na main → bump semântico → tag → HACS.
 */
(() => {
  "use strict";

  const VERSION = "0.2.0";

  /* ------------------------------------------ identidade no editor */
  // >>> mw-element-identity v1 — fonte canônica: /Volumes/SSD-T1-01/CLAUDE-SSD/IA/lib/mw-element-identity/mw-element-identity.js
  // Identidade dos elementos MW na lista do editor do picture-elements.
  // Detalhes e justificativa: IA/knowledge/ha-picture-elements-editor.md.
  const MW_ID_PREFIX = "ui.panel.lovelace.editor.card.picture-elements.element_types.";
  const MW_ID_ROW = "hui-picture-elements-card-row-editor";

  // registro no padrão do window.customCards, só que para elementos
  const MW_WIN = (() => {
    const w = typeof window !== "undefined" ? window : globalThis;
    if (!w.mwPictureElements) w.mwPictureElements = [];
    if (!w.__mwElementIdentity) w.__mwElementIdentity = { wrap: null };
    return w;
  })();

  const mwEntry = (type) =>
    MW_WIN.mwPictureElements.find((e) => e && e.type === type) || null;

  // Linha 1 — embrulha o localize do hass para responder à chave do nosso tipo.
  // Só intercepta chaves do prefixo acima; qualquer outra vai inteira ao HA.
  const mwElementIdentity = (hass) => {
    try {
      const st = MW_WIN.__mwElementIdentity;
      if (!hass || typeof hass.localize !== "function") return;
      if (hass.localize === st.wrap) return;          // já é o nosso
      const orig = hass.localize;
      const wrap = function (key) {
        if (typeof key === "string" && key.indexOf(MW_ID_PREFIX) === 0) {
          const hit = mwEntry(key.slice(MW_ID_PREFIX.length));
          if (hit && hit.name) return hit.name;
        }
        return orig.apply(this, arguments);
      };
      hass.localize = wrap;
      if (hass.localize !== wrap) return;             // objeto congelado
      st.wrap = wrap;
      mwRefreshRows();
    } catch (e) { /* editor bonito não vale um erro em tela */ }
  };

  // Linha 2 — o `title` da config já resolve nativamente; isto só acrescenta
  // uma reserva boa (nome amigável da entidade) quando não há título.
  // Se o HA renomear o método interno, sai de cena sem barulho.
  let mwSecondaryAsked = false;
  const mwPatchSecondary = () => {
    try {
      if (mwSecondaryAsked) return;
      if (typeof customElements === "undefined") return;
      if (typeof customElements.whenDefined !== "function") return;
      mwSecondaryAsked = true;
      customElements.whenDefined(MW_ID_ROW).then(() => {
        const cls = customElements.get(MW_ID_ROW);
        const proto = cls && cls.prototype;
        if (!proto || proto.__mwSecondary) return;
        const orig = proto._getSecondaryDescription;
        if (typeof orig !== "function") return;
        proto._getSecondaryDescription = function (element) {
          try {
            const el = element || {};
            const hit = mwEntry(el.type);
            if (hit) {
              if (el.title) return el.title;
              const st = el.entity && this.hass && this.hass.states[el.entity];
              return (st && st.attributes && st.attributes.friendly_name)
                || el.entity || hit.description || hit.name || "";
            }
          } catch (e) { /* cai no original */ }
          return orig.apply(this, arguments);
        };
        proto.__mwSecondary = true;
      }).catch(() => {});
    } catch (e) { /* idem */ }
  };

  // A lista já desenhada não sabe que ganhou nome — pede redesenho. Só custa
  // varredura quando o editor do picture-elements chegou a ser carregado.
  const mwRefreshRows = () => {
    try {
      if (typeof customElements === "undefined" || !customElements.get(MW_ID_ROW)) return;
      if (typeof document === "undefined" || !document.body) return;
      setTimeout(() => {
        const seen = new Set();
        const walk = (root, depth) => {
          if (!root || depth > 14) return;
          let nodes;
          try { nodes = root.querySelectorAll("*"); } catch (e) { return; }
          for (const n of nodes) {
            if (n.localName === MW_ID_ROW && typeof n.requestUpdate === "function") {
              n.requestUpdate();
            }
            const sr = n.shadowRoot;
            if (sr && !seen.has(sr)) { seen.add(sr); walk(sr, depth + 1); }
          }
        };
        try { walk(document.body, 0); } catch (e) { /* nada */ }
      }, 0);
    } catch (e) { /* nada */ }
  };

  const mwRegisterElement = (entry) => {
    if (!entry || !entry.type) return;
    const list = MW_WIN.mwPictureElements;
    const i = list.findIndex((e) => e && e.type === entry.type);
    if (i < 0) list.push(entry); else list[i] = entry;
    mwPatchSecondary();
    // o hass já existe quando o recurso do dashboard carrega; pegar agora faz
    // a primeira abertura do editor já sair com o nome certo
    try {
      const root = document.querySelector && document.querySelector("home-assistant");
      if (root && root.hass) mwElementIdentity(root.hass);
    } catch (e) { /* nada */ }
  };

  // Campo do editor: é o `title` que o HA lê na segunda linha da lista.
  const MW_TITLE_LABEL = "Título (lista do editor)";
  const MW_TITLE_FIELD = { name: "title", selector: { text: {} } };
  // <<< mw-element-identity v1

  /* ------------------------------------------- escala de clima */
  // >>> mw-climate-scale v1 — fonte canônica: /Volumes/SSD-T1-01/CLAUDE-SSD/IA/lib/mw-climate-scale/mw-climate-scale.js
  // Escala canônica de cor por temperatura (°C) e umidade relativa (%).
  // Regra: IA/rules/global/40-cores-de-temperatura-e-umidade.md.
  const MW_CLIMATE_SCALE_ALPHA = 0.5;

  // 19 limites superiores inclusivos → 20 cores (a última vale de 46 °C para cima).
  const MW_TEMP_STOPS = [
    3.99, 6.99, 8.99, 13.99, 15.99, 17.99, 18.99, 20.99, 21.99, 22.99,
    23.99, 24.99, 25.99, 26.99, 29.99, 32.99, 35.99, 39.99, 45.99,
  ];
  const MW_TEMP_RGB = (
    "0,0,0 0,0,139 0,0,255 70,130,180 0,206,209 64,224,208 0,255,255 144,238,144 0,255,0 50,205,50 " +
    "127,255,0 154,205,50 255,255,0 255,215,0 255,165,0 255,99,71 255,69,0 178,34,34 139,0,0 139,0,0"
  ).split(" ");

  // Uma faixa por ponto percentual: índice n cobre [n, n+1); 100 é faixa própria.
  // O template original fecha a faixa em n.99 e deixa (n.99, n+1) sem dono — o
  // laço cai no fallback, que é a cor de 100% (preto). Sensor que reporte
  // 58,995 % pisca preto. Aqui o vão é fechado de propósito.
  const MW_HUM_RGB = (
    "0,0,0 51,0,0 102,0,0 153,0,0 204,0,0 255,0,0 255,11,0 255,22,0 255,33,0 255,45,0 " +
    "255,56,0 255,67,0 255,78,0 255,89,0 255,100,0 255,111,0 255,122,0 255,133,0 255,144,0 255,155,0 " +
    "255,165,0 255,170,0 255,174,0 255,179,0 255,183,0 255,188,0 255,192,0 255,197,0 255,201,0 255,206,0 " +
    "255,210,0 255,215,0 255,219,0 255,224,0 255,228,0 255,233,0 255,237,0 255,242,0 255,246,0 255,251,0 " +
    "255,255,0 170,255,85 85,255,170 0,255,255 12,252,253 24,249,251 36,246,249 48,243,247 60,240,245 72,237,243 " +
    "84,234,241 96,231,239 108,228,237 120,225,235 132,222,234 144,219,231 156,216,229 173,216,230 115,144,238 58,72,246 " +
    "0,0,255 0,0,249 0,0,243 0,0,237 0,0,231 0,0,225 0,0,219 0,0,213 0,0,207 0,0,201 " +
    "0,0,195 0,0,189 0,0,183 0,0,177 0,0,171 0,0,165 0,0,159 0,0,153 0,0,147 0,0,141 " +
    "0,0,139 0,0,132 0,0,125 0,0,118 0,0,111 0,0,104 0,0,97 0,0,90 0,0,83 0,0,76 " +
    "0,0,69 0,0,62 0,0,55 0,0,48 0,0,41 0,0,34 0,0,27 0,0,20 0,0,13 0,0,6 " +
    "0,0,0"
  ).split(" ");
  const MW_HUM_STOPS = MW_HUM_RGB.slice(1).map((_, i) => i + 0.99);

  const mwClimateRgba = (triplet, alpha) => `rgba(${triplet.split(",").join(", ")}, ${alpha})`;

  // Faixas + cores no formato do algoritmo de faixa comum: a cor é a primeira
  // cujo limite superior não foi ultrapassado. `clamp` existe porque umidade
  // fora de 0..100 é ruído de sensor, não frio.
  const mwClimateScale = (kind, alpha) => {
    const a = Number.isFinite(Number(alpha)) ? Number(alpha) : MW_CLIMATE_SCALE_ALPHA;
    const hum = kind === "hum" || kind === "humidity" || kind === "umidade";
    return {
      stops: hum ? MW_HUM_STOPS : MW_TEMP_STOPS,
      colors: (hum ? MW_HUM_RGB : MW_TEMP_RGB).map((t) => mwClimateRgba(t, a)),
      clamp: hum ? [0, 100] : null,
    };
  };

  // Cor seca (sem degradê), do jeito que o button-card faz.
  const mwClimateColor = (kind, value, alpha) => {
    const s = mwClimateScale(kind, alpha);
    let v = Number(value);
    if (!Number.isFinite(v)) return null;
    if (s.clamp) v = Math.min(s.clamp[1], Math.max(s.clamp[0], v));
    const i = s.stops.findIndex((stop) => v <= stop);
    return s.colors[i === -1 ? s.stops.length : i];
  };
  // <<< mw-climate-scale v1

  /* ------------------------------------ escala de qualidade do ar */
  // >>> mw-air-quality-scale v1 — fonte canônica: /Volumes/SSD-T1-01/CLAUDE-SSD/IA/lib/mw-air-quality-scale/mw-air-quality-scale.js
  // Escala canônica de cor para qualidade do ar (CO₂, TVOC, HCHO, PM).
  // Regra: IA/rules/global/90-cores-de-qualidade-do-ar.md.
  // As três cores são as do próprio HA, para que um gauge nativo e um
  // componente nosso na mesma tela não discordem.
  const MW_AQ_GREEN = "#43a047";   // --success-color  · bom
  const MW_AQ_AMBER = "#ffa600";   // --warning-color  · atenção
  const MW_AQ_RED = "#db4437";     // --error-color    · ruim

  // grandeza → { nome, unidade, min, max, degraus [valor de início, cor] }.
  // `min`/`max` existem para quem desenha mostrador (gauge, régua, barra);
  // quem só quer a cor usa os degraus.
  const MW_AQ_SCALE = {
    co2:  { name: "CO₂", unit: "ppm", min: 350, max: 2000,
            steps: [[350, MW_AQ_GREEN], [800, MW_AQ_AMBER], [1200, MW_AQ_RED]] },
    tvoc: { name: "TVOC", unit: "ppm", min: 0, max: 2,
            steps: [[0, MW_AQ_GREEN], [0.3, MW_AQ_AMBER], [0.6, MW_AQ_RED]] },
    hcho: { name: "Formaldeído", unit: "mg/m³", min: 0, max: 0.3,
            steps: [[0, MW_AQ_GREEN], [0.08, MW_AQ_AMBER], [0.1, MW_AQ_RED]] },
    pm25: { name: "PM2.5", unit: "µg/m³", min: 0, max: 150,
            steps: [[0, MW_AQ_GREEN], [12, MW_AQ_AMBER], [35, MW_AQ_RED]] },
  };
  // apelidos: o que o dono e as integrações chamam a mesma grandeza
  const MW_AQ_ALIAS = {
    carbon_dioxide: "co2", dioxido_de_carbono: "co2", co2: "co2",
    voc: "tvoc", vocs: "tvoc", tvoc: "tvoc", volatile_organic_compounds: "tvoc",
    formaldeido: "hcho", formaldehyde: "hcho", hcho: "hcho", ch2o: "hcho",
    pm25: "pm25", "pm2_5": "pm25", "pm2.5": "pm25", particulate_matter: "pm25",
  };

  const mwAirKind = (kind) => {
    const k = String(kind || "").toLowerCase().trim();
    return MW_AQ_ALIAS[k] || (MW_AQ_SCALE[k] ? k : null);
  };

  // Cor do degrau: o último degrau cujo valor de início já foi alcançado.
  // Abaixo do primeiro degrau ainda é "bom" (0 ppm de CO₂ não existe na
  // prática, mas sensor mudo reportando 0 não deve pintar de vermelho).
  const mwAirColor = (kind, value, alpha) => {
    const k = mwAirKind(kind);
    if (!k) return null;
    const v = Number(value);
    if (!Number.isFinite(v)) return null;
    const steps = MW_AQ_SCALE[k].steps;
    let hex = steps[0][1];
    for (const [from, color] of steps) { if (v >= from) hex = color; }
    return mwAirRgba(hex, alpha);
  };

  // "bom" | "atencao" | "ruim" — para quem precisa do nível, não da cor
  // (ícone, texto, ordenação, automação).
  const MW_AQ_LEVELS = ["bom", "atencao", "ruim"];
  const mwAirLevel = (kind, value) => {
    const k = mwAirKind(kind);
    if (!k) return null;
    const v = Number(value);
    if (!Number.isFinite(v)) return null;
    const steps = MW_AQ_SCALE[k].steps;
    let i = 0;
    steps.forEach(([from], idx) => { if (v >= from) i = idx; });
    return MW_AQ_LEVELS[i];
  };

  // #rrggbb → rgba(...) quando pedem alfa; sem alfa devolve o hex intacto,
  // que é o que os gauges nativos já usam.
  const mwAirRgba = (hex, alpha) => {
    const a = Number(alpha);
    if (!Number.isFinite(a)) return hex;
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex));
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };

  // Degraus no formato do custom:modern-circular-gauge (e do type: gauge
  // nativo, que lê `severity`). Mesma saída do `segmentos()` do Python.
  const mwAirSegments = (kind) => {
    const k = mwAirKind(kind);
    if (!k) return null;
    return MW_AQ_SCALE[k].steps.map(([from, color]) => ({ from, color }));
  };
  // <<< mw-air-quality-scale v1

  /* ------------------------------------------------------- presets
   * Cada preset diz: como achar a cor, que unidade e quantas casas mostrar,
   * e com que alfa pintar. Alfa é parte do preset porque a área é pintada
   * POR CIMA da planta: opaco esconde o desenho da parede.
   */
  const PRESET_ALIAS = {
    temp: "temperature", temperatura: "temperature",
    hum: "humidity", umidade: "humidity",
    voc: "tvoc", vocs: "tvoc", formaldeido: "hcho",
    "pm2.5": "pm25", pm2_5: "pm25",
    illuminance: "lux", iluminancia: "lux", luz: "lux",
    bateria: "battery",
    presenca: "presence", ocupacao: "presence", movimento: "presence",
    onoff: "binary", "on_off": "binary",
  };

  // device_class → preset, para o `preset: auto`
  const DEVICE_CLASS_PRESET = {
    temperature: "temperature", humidity: "humidity",
    carbon_dioxide: "co2", volatile_organic_compounds_parts: "tvoc",
    volatile_organic_compounds: "tvoc", pm25: "pm25", pm1: "pm25", pm10: "pm25",
    illuminance: "lux", battery: "battery",
    motion: "presence", occupancy: "presence", presence: "presence",
  };

  // >>> mw-level-scale v1 — fonte canônica: /Volumes/SSD-T1-01/CLAUDE-SSD/IA/lib/mw-level-scale/mw-level-scale.js
  // Escalas de nível: iluminância (lx) e bateria (%).
  // Doc: IA/knowledge/escala-de-iluminancia.md.
  const MW_LEVEL_ALPHA = 0.5;

  // --- ILUMINÂNCIA -------------------------------------------------------
  // Limites SUPERIORES inclusivos, do mais escuro para o mais claro. Os
  // degraus crescem em razão ~3-4x porque a percepção de luz é logarítmica:
  // a diferença entre 0 e 20 lx muda a vida do morador, a diferença entre
  // 800 e 1200 lx não muda nada. Os números saíram do que os sensores da
  // casa realmente reportam (medição de 2026-09-02: 0, 4, 6, 8, 10, 20, 31,
  // 35 lx; remedição de 2026-09-06 com 15 sensores: p50 = 10, p90 = 96,
  // max = 180) — a vida útil da escala está toda abaixo de 200 lx, e uma
  // escala linear até 1000 pintaria a casa inteira da mesma cor.
  // A cor é azul-noite -> âmbar de sol, e NÃO é a rampa de temperatura de
  // propósito: quem olha a planta térmica e a planta de luz lado a lado não
  // pode confundir as duas.
  const MW_LUX_STOPS = [0.9, 5, 20, 80, 250, 800];
  const MW_LUX_RGB = [
    "10, 14, 30",     // escuro — noite, olho adaptado
    "40, 48, 90",     // penumbra — dá para andar
    "70, 90, 150",    // luz fraca — TV, abajur
    "120, 160, 210",  // luz de ambiente
    "190, 215, 235",  // claro — leitura confortável
    "245, 235, 170",  // muito claro — luz de tarefa
    "255, 214, 90",   // sol entrando
  ];

  // --- BATERIA -----------------------------------------------------------
  // Limites SUPERIORES inclusivos, em %. Ruim -> bom, vermelho -> verde.
  // `canonica`: a régua documentada na página de iluminância, usada pelo
  // mw-ha-state-color-element. Quatro degraus.
  const MW_BAT_CANON_STOPS = [10, 20, 40, 60];
  const MW_BAT_CANON_RGB = [
    "219, 68, 55",   // <=10 % — troque hoje
    "255, 140, 0",   // <=20 % — troque esta semana
    "255, 166, 0",   // <=40 % — de olho
    "154, 205, 50",  // <=60 % — tranquilo
    "67, 160, 71",   // acima — cheia
  ];
  // `fina`: a régua do mw-ha-rainbow-card. Cinco degraus — separa "quase
  // morta" (<=5 %) de "morrendo" (<=20 %) e ainda enxerga o topo da carga
  // (<=80 %), que num arco-íris de 8 dispositivos lado a lado é o que deixa
  // ver qual pilha vai cair primeiro.
  const MW_BAT_FINA_STOPS = [5, 20, 40, 60, 80];
  const MW_BAT_FINA_RGB = [
    "139, 0, 0",     // <=5 %  — quase morta
    "229, 57, 53",   // <=20 % — morrendo
    "255, 152, 0",   // <=40 % — de olho
    "253, 216, 53",  // <=60 % — ainda dá
    "156, 204, 101", // <=80 % — tranquilo
    "67, 160, 71",   // acima  — cheia
  ];

  const MW_LEVEL_ALIAS = {
    lux: "lux", lx: "lux", illuminance: "lux", iluminancia: "lux", luz: "lux",
    battery: "battery", bateria: "battery", bat: "battery",
    battery_fina: "battery_fina", bateria_fina: "battery_fina", fina: "battery_fina",
    battery_canonica: "battery", bateria_canonica: "battery", canonica: "battery",
  };

  const mwLevelRgba = (triplet, alpha) =>
    `rgba(${triplet}, ${alpha === undefined || alpha === null ? MW_LEVEL_ALPHA : alpha})`;

  const MW_LEVEL_TABLES = {
    lux: { stops: MW_LUX_STOPS, rgb: MW_LUX_RGB, clamp: null, unit: "lx", decimals: 0 },
    battery: { stops: MW_BAT_CANON_STOPS, rgb: MW_BAT_CANON_RGB, clamp: [0, 100], unit: "%", decimals: 0 },
    battery_fina: { stops: MW_BAT_FINA_STOPS, rgb: MW_BAT_FINA_RGB, clamp: [0, 100], unit: "%", decimals: 0 },
  };

  const mwLevelKind = (kind) => {
    const k = String(kind || "").toLowerCase().trim();
    return MW_LEVEL_ALIAS[k] || (MW_LEVEL_TABLES[k] ? k : null);
  };

  // Devolve {stops, colors, clamp} — a mesma forma que mwClimateScale, para
  // que o consumidor tenha um caminho de pintura só. Limite SUPERIOR
  // inclusivo: a cor é a da primeira faixa cujo limite não foi ultrapassado.
  const mwLevelScale = (kind, alpha) => {
    const k = mwLevelKind(kind);
    if (!k) return null;
    const t = MW_LEVEL_TABLES[k];
    return {
      stops: t.stops.slice(),
      colors: t.rgb.map((c) => mwLevelRgba(c, alpha)),
      clamp: t.clamp ? t.clamp.slice() : null,
    };
  };

  // Vazio/nulo NÃO é zero. Number("") e Number(null) devolvem 0, e um sensor
  // sem leitura acabaria pintado como 0 lx (o degrau mais escuro) ou 0 % de
  // pilha (o mais vermelho) em vez de cair na cor de "sem leitura" do
  // consumidor. A guarda mora aqui para nenhum consumidor ter de lembrar.
  const mwLevelNum = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const v = Number(value);
    return Number.isFinite(v) ? v : null;
  };

  const mwLevelColor = (kind, value, alpha) => {
    const s = mwLevelScale(kind, alpha);
    if (!s) return null;
    let v = mwLevelNum(value);
    if (v === null) return null;
    if (s.clamp) v = Math.min(Math.max(v, s.clamp[0]), s.clamp[1]);
    const i = s.stops.findIndex((stop) => v <= stop);
    return s.colors[i === -1 ? s.stops.length : i];
  };
  // <<< mw-level-scale v1

  const rgbaOf = (triplet, alpha) => `rgba(${triplet}, ${alpha})`;

  const PRESETS = {
    temperature: { kind: "climate:temp", unit: "°C", decimals: 1, alpha: 0.5 },
    humidity: { kind: "climate:hum", unit: "%", decimals: 1, alpha: 0.5 },
    co2: { kind: "air:co2", unit: "ppm", decimals: 0, alpha: 0.45 },
    tvoc: { kind: "air:tvoc", unit: "ppm", decimals: 2, alpha: 0.45 },
    hcho: { kind: "air:hcho", unit: "mg/m³", decimals: 2, alpha: 0.45 },
    pm25: { kind: "air:pm25", unit: "µg/m³", decimals: 0, alpha: 0.45 },
    lux: { kind: "table:lux", unit: "lx", decimals: 0, alpha: 0.5 },
    battery: { kind: "table:bat", unit: "%", decimals: 0, alpha: 0.5 },
    presence: { kind: "presence", unit: "", decimals: 0, alpha: 1, show_value: false },
    binary: { kind: "binary", unit: "", decimals: 0, alpha: 0.45, show_value: false },
    custom: { kind: "custom", unit: "", decimals: 1, alpha: 0.5 },
    none: { kind: "none", unit: "", decimals: 1, alpha: 1, show_value: false },
  };

  // Presença — porte fiel do `presenca_sensor_style` dos home-9-0-*, inclusive
  // a ordem de prioridade: ocupação vence movimento, e "todos quebrados" tem
  // cor própria (vinho) para não passar por "livre".
  const PRESENCE_COLORS = {
    occupied: "rgba(255, 140, 0, 0.55)",
    motion: "rgba(135, 206, 250, 0.40)",
    clear: "rgba(0, 0, 0, 0.20)",
    broken: "rgba(80, 0, 0, 0.45)",
    empty: "rgba(0, 0, 0, 0.20)",
  };

  /* ------------------------------------------------------------- âncora */
  // A que ponto da área o `left`/`top` se refere. Isto NÃO é enfeite: o
  // picture-elements do HA aplica `transform: translate(-50%, -50%)` em TODO
  // filho de `#root` (`.element` no CSS do hui-picture-elements-card), ou
  // seja, a convenção nativa do HA é o CENTRO. Quem não escreve `transform`
  // herda o centro sem saber — foi o que acontecia aqui até a v0.1.0, em que
  // `anchor: top-left` era o padrão declarado e não valia nada.
  //
  // Agora o transform é SEMPRE escrito, e por isso o padrão passa a ser
  // `center`: mantém a tela idêntica ao que já estava no ar e igual à do
  // resto do HA. Quem quer que `left`/`top` sejam o canto de cima escolhe
  // `top-left` — e agora funciona.
  //
  //   canto  →  center        (o que o HA faz por padrão)
  //   top-left = left + 0     · top + 0
  //   center   = left − L/2   · top − A/2   ⟹ para converter um retângulo
  //   desenhado como canto para a convenção do centro, some metade:
  //   left_centro = left_canto + L/2 · top_centro = top_canto + A/2
  const ANCHOR_SHIFT = {
    "top-left": [0, 0], top: [-50, 0], "top-right": [-100, 0],
    left: [0, -50], center: [-50, -50], right: [-100, -50],
    "bottom-left": [0, -100], bottom: [-50, -100], "bottom-right": [-100, -100],
  };
  // sinônimos que a mão escreve sem pensar
  const ANCHOR_ALIAS = {
    "top-center": "top", "center-top": "top", "middle-top": "top",
    "center-left": "left", "middle-left": "left", "left-center": "left",
    "center-right": "right", "middle-right": "right", "right-center": "right",
    "bottom-center": "bottom", "center-bottom": "bottom", "middle-bottom": "bottom",
    "center-center": "center", middle: "center", "": "center",
    "left-top": "top-left", "top left": "top-left",
    "right-top": "top-right", "left-bottom": "bottom-left",
    "right-bottom": "bottom-right",
  };
  const anchorShift = (a) => {
    const k = String(a === null || a === undefined ? "" : a).trim().toLowerCase();
    const norm = ANCHOR_SHIFT[k] ? k : (ANCHOR_ALIAS[k] || "center");
    return ANCHOR_SHIFT[norm] || ANCHOR_SHIFT.center;
  };

  const DEFAULTS = {
    // --- leitura ---
    entity: "",
    attribute: "",              // pinta por atributo em vez do state
    preset: "auto",             // auto | temperature | humidity | co2 | tvoc |
                                // hcho | pm25 | lux | battery | presence |
                                // binary | custom | none
    name: "",                   // tooltip; vazio = title, depois friendly_name
    title: "",                  // rótulo na lista do editor; não aparece na planta

    // --- geometria (o que estiver aqui vence o `style:` do YAML) ---
    left: "", top: "", width: "", height: "",
    anchor: "center",           // a que ponto da área `left`/`top` se referem:
                                // top-left | top | top-right | left | center |
                                // right | bottom-left | bottom | bottom-right
    rotate: null,               // gira a área inteira
    radius: "",                 // ex.: "6px" — canto arredondado da área
    z_index: null,

    // --- pintura ---
    alpha: null,                // null = alfa do preset
    mode: "step",               // step | gradient
    border: 0,                  // px da borda
    border_color: "",           // vazio = a própria cor, mais opaca
    color_unavailable: "rgba(0, 0, 0, 0.30)",
    color_unknown: "",          // vazio = mesma de indisponível
    color_none: "rgba(0, 0, 0, 0.20)",
    fade: 0.6,                  // segundos de transição de cor
    min: null, max: null,       // só para `mode: gradient` com escala custom

    // --- escala custom (preset: custom) ---
    stops: null,                // [12, 35]           limites superiores
    colors: null,               // ["#43a047", …]     uma cor a mais que stops
    clamp: null,                // [0, 100]

    // --- presença (preset: presence) ---
    motion_entities: [],
    occupancy_entities: [],
    color_occupied: "", color_motion: "", color_clear: "", color_broken: "",

    // --- binário (preset: binary) ---
    color_on: "rgba(255, 193, 7, 0.45)",
    color_off: "rgba(0, 0, 0, 0.20)",
    invert: false,

    // --- texto ---
    show_value: null,           // null = o que o preset disser (padrão: sim)
    decimals: null,             // null = casas do preset
    unit: "",                   // "" = unidade da entidade/preset · "none" = sem
    prefix: "", suffix: "",
    label: "",                  // texto fixo no lugar do valor
    text_rotate: 0,             // 0 | 90 | -90 | 180
    text_offset: "0%",          // translateY depois de girar
    font_size: "14px",
    font_weight: "bold",
    text_color: "var(--primary-text-color)",
    text_shadow: false,         // contorno escuro, para área muito clara
    text_when_unavailable: "—", // "" = esconde o texto

    // --- visibilidade ---
    hide_unavailable: false,

    // --- ações ---
    tap_action: "more-info",
    hold_action: "more-info",
    double_tap_action: "none",
    navigation_path: "", url_path: "", service: "", service_data: null,
  };

  const ON = new Set(["on", "detected", "home", "open", "active", "motion", "occupied"]);
  const BAD = new Set(["unavailable", "unknown", "", null, undefined]);

  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const px = (v) => (/^\d+(\.\d+)?$/.test(String(v)) ? `${v}px` : String(v));

  const fire = (node, type, detail) => {
    const ev = new CustomEvent(type, { detail, bubbles: true, composed: true });
    node.dispatchEvent(ev);
    return ev;
  };

  /* ------------------------------------------------- cor por valor
   * Um algoritmo só para todas as escalas de tabela: `stops` são limites
   * superiores inclusivos e `colors` tem um elemento a mais (a cor de "acima
   * do último limite"). É o mesmo contrato do mw-climate-scale, para que
   * escala custom e escala canônica passem pelo mesmo caminho.
   */
  const tableColor = (scale, value, mode) => {
    let v = Number(value);
    if (!Number.isFinite(v)) return null;
    const { stops, colors, clamp } = scale;
    if (clamp) v = Math.min(clamp[1], Math.max(clamp[0], v));
    if (!stops || !stops.length) return colors && colors[0];
    if (mode !== "gradient") {
      const i = stops.findIndex((s) => v <= s);
      return colors[i === -1 ? stops.length : i];
    }
    // degradê: cada cor é ancorada no limite superior da própria faixa; a
    // primeira também ancora o começo, a última segue reta até o infinito.
    if (v <= stops[0]) return colors[0];
    if (v > stops[stops.length - 1]) return colors[stops.length];
    const i = stops.findIndex((s) => v <= s);
    const a = stops[i - 1], b = stops[i];
    const t = b === a ? 0 : (v - a) / (b - a);
    return mixColor(colors[i - 1], colors[i], t);
  };

  // Mistura duas cores no formato que as tabelas usam (rgba/rgb/#hex).
  const parseColor = (c) => {
    const s = String(c || "").trim();
    let m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i.exec(s);
    if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
    m = /^#?([0-9a-f]{6})$/i.exec(s);
    if (m) {
      const n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
    }
    m = /^#?([0-9a-f]{3})$/i.exec(s);
    if (m) {
      const h = m[1];
      return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), 1];
    }
    return null;
  };
  const mixColor = (c1, c2, t) => {
    const a = parseColor(c1), b = parseColor(c2);
    if (!a || !b) return c2;
    const l = (i) => Math.round(a[i] + (b[i] - a[i]) * t);
    const alpha = +(a[3] + (b[3] - a[3]) * t).toFixed(3);
    return `rgba(${l(0)}, ${l(1)}, ${l(2)}, ${alpha})`;
  };
  // cor da borda: a mesma cor, só que firme
  const solidify = (c, boost) => {
    const p = parseColor(c);
    if (!p) return c;
    return `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${Math.min(1, p[3] + boost).toFixed(3)})`;
  };

  const tableFrom = (rgbList, stops, alpha) => ({
    stops,
    colors: rgbList.map((t) => rgbaOf(t, alpha)),
    clamp: null,
  });

  class MwStateColorElement extends HTMLElement {
    static getStubConfig() {
      return {
        type: "custom:mw-state-color-element",
        entity: "", preset: "auto",
        left: "10%", top: "10%", width: "20%", height: "10%",
      };
    }

    static getConfigElement() {
      return document.createElement("mw-state-color-element-editor");
    }

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._watch = [];
      this._seen = [];
      this._holdFired = false;
      this.addEventListener("click", (e) => {
        if (this._holdFired) { this._holdFired = false; return; }
        e.stopPropagation();
        this._run(this._cfg && this._cfg.tap_action);
      });
      this.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        this._run(this._cfg && this._cfg.double_tap_action);
      });
      this.addEventListener("pointerdown", () => {
        this._holdTimer = setTimeout(() => {
          this._holdFired = true;
          this._run(this._cfg && this._cfg.hold_action);
        }, 500);
      });
      const cancel = () => clearTimeout(this._holdTimer);
      this.addEventListener("pointerup", cancel);
      this.addEventListener("pointercancel", cancel);
      this.addEventListener("pointerleave", cancel);
    }

    setConfig(config) {
      const cfg = { ...DEFAULTS, ...(config || {}) };
      const preset = this._resolvePreset(cfg.preset);
      if (preset !== "presence" && preset !== "none" && !cfg.entity) {
        throw new Error("mw-state-color-element: informe 'entity' (ou use preset: presence / none)");
      }
      if (preset === "custom" && !(Array.isArray(cfg.colors) && cfg.colors.length)) {
        throw new Error("mw-state-color-element: preset 'custom' precisa de 'colors'");
      }
      this._cfg = cfg;
      // entidades vigiadas: é só nelas que o `set hass` olha
      this._watch = [cfg.entity]
        .concat(cfg.motion_entities || [], cfg.occupancy_entities || [])
        .filter(Boolean);
      this._seen = new Array(this._watch.length);
      this._applyGeometry();
      this._build();
      this._update();
    }

    set hass(hass) {
      mwElementIdentity(hass);
      const first = !this._hass;
      this._hass = hass;
      if (!this._cfg) return;
      if (!first && this._unchanged(hass)) return;   // O(1) — ver README
      this._update();
    }

    get hass() { return this._hass; }

    getCardSize() { return 1; }

    // Nenhuma das entidades vigiadas trocou de objeto de estado? Então não há
    // nada a redesenhar. O HA recria o `hass` a cada mudança de QUALQUER
    // entidade da casa; sem esta saída, 30 áreas × 1,5 mil eventos/min viram
    // 45 mil repinturas por minuto.
    _unchanged(hass) {
      const states = hass && hass.states;
      if (!states) return false;
      for (let i = 0; i < this._watch.length; i++) {
        const st = states[this._watch[i]];
        if (st !== this._seen[i]) return false;
      }
      return true;
    }

    _resolvePreset(p) {
      const k = String(p || "auto").toLowerCase().trim();
      const named = PRESET_ALIAS[k] || k;
      if (PRESETS[named]) return named;
      return "auto";
    }

    // preset: auto → device_class da entidade; sem device_class, binário vira
    // `binary` e numérico vira `custom` sem escala (cor de "sem preset").
    _effectivePreset(st) {
      const want = this._resolvePreset(this._cfg.preset);
      if (want !== "auto") return want;
      const dc = st && st.attributes && st.attributes.device_class;
      if (dc && DEVICE_CLASS_PRESET[dc]) return DEVICE_CLASS_PRESET[dc];
      if (this._cfg.entity && this._cfg.entity.startsWith("binary_sensor.")) return "binary";
      return "none";
    }

    _applyGeometry() {
      const c = this._cfg;
      const set = (prop, val) => {
        if (val === "" || val === null || val === undefined) return;
        this.style.setProperty(prop, String(val));
      };
      set("left", c.left);
      set("top", c.top);
      set("width", c.width);
      set("height", c.height);
      set("z-index", c.z_index);
      const hasR = c.rotate !== null && c.rotate !== "";
      // SEMPRE escrever o transform: sem ele quem manda é o `.element` do
      // hui-picture-elements-card, que centraliza tudo — e aí a âncora
      // escolhida no editor não sairia do papel.
      const [tx, ty] = anchorShift(c.anchor);
      set("transform",
        `translate(${tx}%, ${ty}%)${hasR ? ` rotate(${c.rotate}deg)` : ""}`);
    }

    _build() {
      const c = this._cfg;
      const shadow = c.text_shadow
        ? "text-shadow:0 1px 2px rgba(0,0,0,0.75), 0 0 3px rgba(0,0,0,0.55);"
        : "";
      this.shadowRoot.innerHTML = `
<style>
  :host{position:absolute;box-sizing:border-box;display:block;overflow:hidden;
        background:var(--mw-fill, transparent);
        ${c.radius ? `border-radius:${c.radius};` : ""}
        ${num(c.border, 0) > 0 ? `border:${px(c.border)} solid var(--mw-edge);` : ""}
        transition:background-color ${num(c.fade, 0.6)}s ease,
                   border-color ${num(c.fade, 0.6)}s ease;}
  :host(.is-hidden){display:none;}
  .wrap{position:absolute;inset:0;display:flex;align-items:center;
        justify-content:center;pointer-events:none;}
  .txt{color:${c.text_color};font-size:${c.font_size};font-weight:${c.font_weight};
       line-height:1.05;white-space:nowrap;text-align:center;${shadow}
       transform:rotate(${num(c.text_rotate, 0)}deg) translateY(${c.text_offset});}
  .txt:empty{display:none;}
  @media (prefers-reduced-motion: reduce){:host{transition:none;}}
</style>
<div class="wrap"><div class="txt"></div></div>`;
      this._txt = this.shadowRoot.querySelector(".txt");
    }

    /* ---------------------------------------------------------- pintura */
    _update() {
      const c = this._cfg;
      if (!c || !this._txt) return;
      const hass = this._hass;
      const states = (hass && hass.states) || {};
      for (let i = 0; i < this._watch.length; i++) this._seen[i] = states[this._watch[i]];

      const st = c.entity ? states[c.entity] : null;
      const preset = this._effectivePreset(st);
      const spec = PRESETS[preset] || PRESETS.none;

      let fill = null;
      let text = "";
      let broken = false;

      if (preset === "presence") {
        fill = this._presenceColor(states);
      } else if (preset === "none" && !c.entity) {
        fill = c.color_none;
      } else if (!st || BAD.has(st.state)) {
        broken = true;
        fill = (st && st.state === "unknown" && c.color_unknown) || c.color_unavailable;
        text = c.text_when_unavailable;
      } else if (preset === "binary") {
        const on = ON.has(String(st.state).toLowerCase()) !== !!c.invert;
        fill = on ? c.color_on : c.color_off;
      } else {
        const raw = c.attribute ? (st.attributes || {})[c.attribute] : st.state;
        fill = this._valueColor(preset, spec, raw);
        if (fill === null) { broken = true; fill = c.color_unavailable; }
        text = this._format(raw, spec, st);
      }

      const showValue = c.show_value === null
        ? (spec.show_value === undefined ? true : spec.show_value)
        : !!c.show_value;
      if (c.label) text = c.label;
      else if (!showValue && !broken) text = "";

      this.style.setProperty("--mw-fill", fill || "transparent");
      if (num(c.border, 0) > 0) {
        this.style.setProperty("--mw-edge", c.border_color || solidify(fill, 0.35));
      }
      if (this._txt.textContent !== text) this._txt.textContent = text;

      const tooltip = c.name || c.title
        || (st && st.attributes && st.attributes.friendly_name) || c.entity || "";
      if (this.title !== tooltip) this.title = tooltip;

      const tap = typeof c.tap_action === "string" ? c.tap_action : (c.tap_action || {}).action;
      this.style.setProperty("cursor", String(tap) === "none" ? "default" : "pointer");

      // só as classes nossas são trocadas — o que o picture-elements tiver
      // posto no host continua lá
      const keep = String(this.className || "").split(/\s+/)
        .filter((x) => x && !/^(is-hidden|s-)/.test(x));
      this.className = keep
        .concat([`s-${broken ? "broken" : preset}`, broken && c.hide_unavailable ? "is-hidden" : ""])
        .filter(Boolean).join(" ");
    }

    // valor → cor, pela escala do preset
    _valueColor(preset, spec, raw) {
      const c = this._cfg;
      const alpha = c.alpha === null || c.alpha === "" ? spec.alpha : num(c.alpha, spec.alpha);
      const kind = spec.kind;
      if (kind === "climate:temp" || kind === "climate:hum") {
        const scale = mwClimateScale(kind === "climate:temp" ? "temp" : "hum", alpha);
        return tableColor(scale, raw, c.mode);
      }
      if (kind && kind.indexOf("air:") === 0) {
        const k = kind.slice(4);
        if (c.mode === "gradient") {
          const s = MW_AQ_SCALE[k];
          return tableColor({
            stops: s.steps.slice(1).map(([v]) => v),
            colors: s.steps.map(([, col]) => mwAirRgba(col, alpha)),
            clamp: null,
          }, raw, "gradient");
        }
        return mwAirColor(k, raw, alpha);
      }
      if (kind === "table:lux") return tableColor(tableFrom(MW_LUX_RGB, MW_LUX_STOPS, alpha), raw, c.mode);
      if (kind === "table:bat") return tableColor(tableFrom(MW_BAT_CANON_RGB, MW_BAT_CANON_STOPS, alpha), raw, c.mode);
      if (kind === "custom") {
        return tableColor({
          stops: Array.isArray(c.stops) ? c.stops.map(Number) : [],
          colors: c.colors,
          clamp: Array.isArray(c.clamp) ? c.clamp.map(Number) : null,
        }, raw, c.mode);
      }
      return c.color_none;
    }

    // Presença — a mesma ordem do `presenca_sensor_style`: ocupação vence
    // movimento; "todos quebrados" tem cor própria; sem sensor nenhum é
    // transparente (a área existe, mas não afirma nada).
    _presenceColor(states) {
      const c = this._cfg;
      const P = PRESENCE_COLORS;
      const movs = (c.motion_entities || []).concat(
        c.entity && !(c.occupancy_entities || []).length ? [c.entity] : []);
      const occs = c.occupancy_entities || [];
      const bad = (id) => { const s = states[id]; return !s || BAD.has(s.state); };
      const anyOn = (ids) => ids.some((id) => states[id] && ON.has(String(states[id].state).toLowerCase()));
      const allBad = (ids) => ids.length === 0 || ids.every(bad);
      if (!movs.length && !occs.length) return c.color_clear || P.empty;
      if (anyOn(occs)) return c.color_occupied || P.occupied;
      if (anyOn(movs)) return c.color_motion || P.motion;
      if (allBad(movs) && allBad(occs)) return c.color_broken || P.broken;
      return c.color_clear || P.clear;
    }

    /* --------------------------------------------------------- texto */
    _format(raw, spec, st) {
      const c = this._cfg;
      const v = Number(raw);
      const attrs = (st && st.attributes) || {};
      let out;
      if (Number.isFinite(v)) {
        let d = c.decimals;
        if (d === null || d === "" || d === undefined) {
          d = Number.isFinite(Number(attrs.display_precision))
            ? Number(attrs.display_precision) : spec.decimals;
        }
        out = this._nf(num(d, 1)).format(v);
      } else {
        out = String(raw === undefined || raw === null ? "" : raw);
      }
      const unit = c.unit === "none" || c.unit === "-" ? ""
        : (c.unit || attrs.unit_of_measurement || spec.unit || "");
      // "%" cola no número e o resto vem com espaço normal — é como o
      // state-label e os gauges nativos escrevem na mesma tela
      const sep = unit === "%" ? "" : " ";
      return `${c.prefix}${out}${unit ? sep + unit : ""}${c.suffix}`;
    }

    _nf(d) {
      const lang = (this._hass && this._hass.locale && this._hass.locale.language)
        || (this._hass && this._hass.language) || undefined;
      const key = `${lang}|${d}`;
      if (this._nfKey !== key) {
        this._nfKey = key;
        try {
          this._nfCache = new Intl.NumberFormat(lang, {
            minimumFractionDigits: d, maximumFractionDigits: d,
          });
        } catch (e) {
          this._nfCache = { format: (x) => Number(x).toFixed(d) };
        }
      }
      return this._nfCache;
    }

    /* -------------------------------------------------------- ações */
    _run(spec) {
      const cfg = this._cfg;
      if (!cfg || !this._hass) return;
      const a = typeof spec === "string" ? { action: spec } : (spec || { action: "none" });
      switch (a.action) {
        case "none":
          return;
        case "toggle":
          this._hass.callService("homeassistant", "toggle",
            { entity_id: a.entity_id || cfg.entity });
          return;
        case "call-service":
        case "perform-action": {
          const svc = a.perform_action || a.service || cfg.service;
          if (!svc || svc.indexOf(".") < 0) return;
          const [dom, srv] = svc.split(".");
          this._hass.callService(dom, srv,
            a.data || a.service_data || cfg.service_data || {}, a.target);
          return;
        }
        case "navigate": {
          const path = a.navigation_path || cfg.navigation_path;
          if (!path) return;
          history.pushState(null, "", path);
          fire(window, "location-changed", { replace: false });
          return;
        }
        case "url": {
          const url = a.url_path || cfg.url_path;
          if (url) window.open(url, a.new_tab === false ? "_self" : "_blank");
          return;
        }
        default: {
          const id = a.entity || cfg.entity
            || (cfg.occupancy_entities || [])[0] || (cfg.motion_entities || [])[0];
          if (id) fire(this, "hass-more-info", { entityId: id });
        }
      }
    }
  }

  /* ---------------------------------------------------------------- editor */
  const LABELS = {
    entity: "Entidade", attribute: "Atributo (opcional)",
    preset: "Escala", name: "Nome (tooltip)", title: MW_TITLE_LABEL,
    left: "Esquerda", top: "Topo", width: "Largura", height: "Altura",
    anchor: "Âncora (a que ponto Esquerda/Topo se referem)",
    rotate: "Girar a área", radius: "Canto arredondado",
    alpha: "Opacidade da cor", mode: "Transição de cor",
    border: "Borda (px)", border_color: "Cor da borda",
    fade: "Esfriamento (s)", z_index: "Camada (z-index)",
    show_value: "Mostrar o valor", decimals: "Casas decimais",
    unit: "Unidade", prefix: "Prefixo", suffix: "Sufixo", label: "Texto fixo",
    text_rotate: "Girar o texto", text_offset: "Deslocar o texto",
    font_size: "Tamanho da fonte", font_weight: "Peso da fonte",
    text_color: "Cor do texto", text_shadow: "Contorno no texto",
    text_when_unavailable: "Texto sem leitura",
    color_unavailable: "Cor sem leitura", color_unknown: "Cor desconhecido",
    color_none: "Cor sem escala", hide_unavailable: "Esconder sem leitura",
    stops: "Limites (custom)", colors: "Cores (custom)", clamp: "Presilha (custom)",
    motion_entities: "Sensores de movimento", occupancy_entities: "Sensores de ocupação",
    color_occupied: "Cor ocupado", color_motion: "Cor movimento",
    color_clear: "Cor livre", color_broken: "Cor sensores quebrados",
    color_on: "Cor ligado", color_off: "Cor desligado", invert: "Inverter estado",
    tap_action: "Toque", hold_action: "Toque longo", double_tap_action: "Toque duplo",
  };

  const sel = (options) => ({ select: { mode: "dropdown", options } });

  const SCHEMA = [
    { name: "entity", selector: { entity: {} } },
    {
      type: "grid", name: "", schema: [
        {
          name: "preset", selector: sel([
            { value: "auto", label: "Automática (device_class)" },
            { value: "temperature", label: "Temperatura (°C)" },
            { value: "humidity", label: "Umidade (%)" },
            { value: "co2", label: "CO₂ (ppm)" },
            { value: "tvoc", label: "TVOC (ppm)" },
            { value: "hcho", label: "Formaldeído (mg/m³)" },
            { value: "pm25", label: "PM2.5 (µg/m³)" },
            { value: "lux", label: "Iluminância (lx)" },
            { value: "battery", label: "Bateria (%)" },
            { value: "presence", label: "Presença / movimento" },
            { value: "binary", label: "Ligado / desligado" },
            { value: "custom", label: "Personalizada" },
            { value: "none", label: "Cor fixa (sem escala)" },
          ]),
        },
        { name: "attribute", selector: { text: {} } },
      ],
    },
    { name: "name", selector: { text: {} } },
    MW_TITLE_FIELD,
    {
      type: "grid", name: "", schema: [
        { name: "left", selector: { text: {} } },
        { name: "top", selector: { text: {} } },
        { name: "width", selector: { text: {} } },
        { name: "height", selector: { text: {} } },
      ],
    },
    {
      name: "anchor", selector: sel([
        { value: "center", label: "Centro — como o Home Assistant (padrão)" },
        { value: "top-left", label: "Canto superior esquerdo" },
        { value: "top", label: "Meio de cima" },
        { value: "top-right", label: "Canto superior direito" },
        { value: "left", label: "Meio da esquerda" },
        { value: "right", label: "Meio da direita" },
        { value: "bottom-left", label: "Canto inferior esquerdo" },
        { value: "bottom", label: "Meio de baixo" },
        { value: "bottom-right", label: "Canto inferior direito" },
      ]),
    },
    {
      type: "grid", name: "", schema: [
        { name: "alpha", selector: { number: { min: 0, max: 1, step: 0.05, mode: "box" } } },
        {
          name: "mode", selector: sel([
            { value: "step", label: "Degraus (padrão)" },
            { value: "gradient", label: "Degradê" },
          ]),
        },
        { name: "show_value", selector: { boolean: {} } },
        { name: "decimals", selector: { number: { min: 0, max: 4, step: 1, mode: "box" } } },
      ],
    },
    {
      type: "grid", name: "", schema: [
        {
          name: "text_rotate", selector: sel([
            { value: 0, label: "Na horizontal" },
            { value: 90, label: "90° (de baixo para cima)" },
            { value: -90, label: "−90°" },
            { value: 180, label: "180°" },
          ]),
        },
        { name: "text_offset", selector: { text: {} } },
        { name: "font_size", selector: { text: {} } },
        { name: "unit", selector: { text: {} } },
      ],
    },
    {
      type: "expandable", name: "", title: "Presença (vários sensores)", schema: [
        { name: "occupancy_entities", selector: { entity: { multiple: true } } },
        { name: "motion_entities", selector: { entity: { multiple: true } } },
        {
          type: "grid", name: "", schema: [
            { name: "color_occupied", selector: { text: {} } },
            { name: "color_motion", selector: { text: {} } },
            { name: "color_clear", selector: { text: {} } },
            { name: "color_broken", selector: { text: {} } },
          ],
        },
      ],
    },
    {
      type: "expandable", name: "", title: "Escala personalizada", schema: [
        { name: "stops", selector: { object: {} } },
        { name: "colors", selector: { object: {} } },
        { name: "clamp", selector: { object: {} } },
      ],
    },
    {
      type: "expandable", name: "", title: "Cores e ajuste fino", schema: [
        {
          type: "grid", name: "", schema: [
            { name: "color_unavailable", selector: { text: {} } },
            { name: "color_unknown", selector: { text: {} } },
            { name: "color_none", selector: { text: {} } },
            { name: "color_on", selector: { text: {} } },
            { name: "color_off", selector: { text: {} } },
            { name: "invert", selector: { boolean: {} } },
            { name: "border", selector: { number: { min: 0, max: 12, step: 1, mode: "box" } } },
            { name: "border_color", selector: { text: {} } },
            { name: "radius", selector: { text: {} } },
            { name: "fade", selector: { number: { min: 0, max: 5, step: 0.1, mode: "box" } } },
            { name: "rotate", selector: { number: { min: -180, max: 180, step: 1, mode: "box" } } },
            { name: "z_index", selector: { number: { min: -5, max: 20, step: 1, mode: "box" } } },
            { name: "text_color", selector: { text: {} } },
            { name: "font_weight", selector: { text: {} } },
            { name: "text_shadow", selector: { boolean: {} } },
            { name: "text_when_unavailable", selector: { text: {} } },
            { name: "hide_unavailable", selector: { boolean: {} } },
            { name: "prefix", selector: { text: {} } },
            { name: "suffix", selector: { text: {} } },
            { name: "label", selector: { text: {} } },
          ],
        },
      ],
    },
    {
      type: "expandable", name: "", title: "Ações", schema: [
        { name: "tap_action", selector: { ui_action: {} } },
        { name: "hold_action", selector: { ui_action: {} } },
        { name: "double_tap_action", selector: { ui_action: {} } },
      ],
    },
  ];

  class MwStateColorElementEditor extends HTMLElement {
    setConfig(config) { this._config = config || {}; this._render(); }
    set hass(hass) { this._hass = hass; this._render(); }

    _render() {
      if (!this._config || !this._hass) return;
      if (!this._form) {
        const f = document.createElement("ha-form");
        f.computeLabel = (s) => LABELS[s.name] || s.name;
        f.addEventListener("value-changed", (ev) => {
          ev.stopPropagation();
          const next = { type: "custom:mw-state-color-element", ...ev.detail.value };
          Object.keys(next).forEach((k) => {
            const v = next[k];
            if (v === "" || v === null || v === undefined) delete next[k];
            if (Array.isArray(v) && !v.length) delete next[k];
          });
          fire(this, "config-changed", { config: next });
        });
        this.appendChild(f);
        this._form = f;
      }
      this._form.hass = this._hass;
      this._form.schema = SCHEMA;
      // o formulário mostra o padrão em vigor, não campo vazio
      const data = { ...this._config };
      ["preset", "anchor", "mode", "fade", "text_rotate", "text_offset",
        "font_size", "text_color", "tap_action", "hold_action",
        "color_unavailable", "text_when_unavailable"].forEach((k) => {
          if (data[k] === undefined) data[k] = DEFAULTS[k];
        });
      this._form.data = data;
    }
  }

  mwRegisterElement({
    type: "custom:mw-state-color-element",
    name: "Área por estado",
    description: "MW · área da planta pintada pela leitura",
  });

  if (!customElements.get("mw-state-color-element")) {
    customElements.define("mw-state-color-element", MwStateColorElement);
  }
  if (!customElements.get("mw-state-color-element-editor")) {
    customElements.define("mw-state-color-element-editor", MwStateColorElementEditor);
  }

  console.info(
    `%c MW-STATE-COLOR-ELEMENT %c ${VERSION} `,
    "color:#0b1021;background:#4fc3f7;font-weight:700",
    "color:#4fc3f7;background:#0b1021"
  );
})();
