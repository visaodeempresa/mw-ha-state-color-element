/* Probe headless — instancia o elemento fora do navegador e confere o que
 * some quando alguém mexe: cor por preset (clima, ar, presença, binário,
 * custom), degradê, texto formatado no idioma do HA, geometria no host,
 * a saída em O(1) do `set hass`, o editor e a identidade na lista.
 * Roda no CI e antes de qualquer push:  node tools/probe.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

const mkStyle = () => {
  const s = {};
  s.setProperty = (k, v) => { s[k] = v; };
  return s;
};

const mkNode = (tag) => {
  const n = { attrs: {}, style: mkStyle(), children: [], _listeners: {}, textContent: "" };
  n.tagName = String(tag || "div").toUpperCase();
  n.setAttribute = (k, v) => { n.attrs[k] = v; };
  n.appendChild = (c) => { n.children.push(c); return c; };
  n.addEventListener = (t, f) => { (n._listeners[t] = n._listeners[t] || []).push(f); };
  n.dispatchEvent = () => true;
  return n;
};

global.HTMLElement = class {
  constructor() { this.style = mkStyle(); this._listeners = {}; this.children = []; }
  appendChild(n) { this.children.push(n); return n; }
  attachShadow() {
    const node = mkNode();
    this.shadowRoot = { innerHTML: "", querySelector: () => node };
    return this.shadowRoot;
  }
  addEventListener(t, f) { (this._listeners[t] = this._listeners[t] || []).push(f); }
  dispatchEvent() {}
};
global.document = { createElement: (t) => mkNode(t) };
const reg = {};
global.customElements = { define: (n, c) => (reg[n] = c), get: (n) => reg[n] };
global.window = {};
global.CustomEvent = class { constructor(t, d) { this.type = t; Object.assign(this, d); } };
global.setTimeout = setTimeout;
global.clearTimeout = clearTimeout;
console.info = () => {};

const SRC = path.join(__dirname, "..", "dist", "mw-state-color-element.js");
eval(fs.readFileSync(SRC, "utf8"));

const S = (state, attributes = {}) => ({ state: String(state), attributes });
const hass = {
  language: "pt-BR",
  locale: { language: "pt-BR" },
  states: {
    "sensor.temp_cozinha": S(23.4, { unit_of_measurement: "°C", device_class: "temperature", friendly_name: "Temperatura da Cozinha" }),
    "sensor.temp_quente": S(34.2, { unit_of_measurement: "°C", device_class: "temperature" }),
    "sensor.umid_cozinha": S(58, { unit_of_measurement: "%", device_class: "humidity" }),
    "sensor.co2_escritorio": S(900, { unit_of_measurement: "ppm", device_class: "carbon_dioxide" }),
    "sensor.co2_bom": S(368, { unit_of_measurement: "ppm" }),
    "sensor.tvoc": S(0.7, { unit_of_measurement: "ppm" }),
    "sensor.hcho": S(0.02, { unit_of_measurement: "mg/m³" }),
    "sensor.pm25": S(40, {}),
    "sensor.lux": S(31, { unit_of_measurement: "lx", device_class: "illuminance" }),
    "sensor.bateria": S(15, { unit_of_measurement: "%", device_class: "battery" }),
    "sensor.sumido": S("unavailable", {}),
    "sensor.confuso": S("unknown", {}),
    "sensor.com_precisao": S(23.456, { unit_of_measurement: "°C", display_precision: 2, device_class: "temperature" }),
    "sensor.com_atributo": S("ok", { pm25: 40 }),
    "binary_sensor.mov_cozinha": S("on", { device_class: "motion" }),
    "binary_sensor.mov_sala": S("off", { device_class: "motion" }),
    "binary_sensor.ocup_sala": S("on", { device_class: "occupancy" }),
    "binary_sensor.quebrado": S("unavailable", { device_class: "motion" }),
    "binary_sensor.porta": S("on", { device_class: "door" }),
  },
  calls: [],
  callService(dom, srv, data) { this.calls.push([dom, srv, data]); },
};

let fails = 0;
const check = (label, cond, extra = "") => {
  if (cond) { console.log(`  ok   ${label}`); return; }
  fails += 1;
  console.log(`  FAIL ${label}${extra ? " — " + extra : ""}`);
};

const make = (config) => {
  const el = new reg["mw-state-color-element"]();
  el.setConfig(config);
  el.hass = hass;
  return el;
};
const fill = (el) => el.style["--mw-fill"];
const text = (el) => el.shadowRoot.querySelector(".txt").textContent;

console.log("escalas canônicas (regras 40 e 90):");
check("temperatura 23,4 °C = verde-limão do button-card",
  fill(make({ entity: "sensor.temp_cozinha", preset: "temperature" })) === "rgba(127, 255, 0, 0.5)",
  fill(make({ entity: "sensor.temp_cozinha", preset: "temperature" })));
check("temperatura 34,2 °C = vermelho-alaranjado",
  fill(make({ entity: "sensor.temp_quente", preset: "temperature" })) === "rgba(255, 69, 0, 0.5)",
  fill(make({ entity: "sensor.temp_quente", preset: "temperature" })));
check("umidade 58 % = azul do template",
  fill(make({ entity: "sensor.umid_cozinha", preset: "humidity" })) === "rgba(115, 144, 238, 0.5)",
  fill(make({ entity: "sensor.umid_cozinha", preset: "humidity" })));
check("CO₂ 900 ppm = atenção (--warning-color)",
  fill(make({ entity: "sensor.co2_escritorio", preset: "co2" })) === "rgba(255, 166, 0, 0.45)",
  fill(make({ entity: "sensor.co2_escritorio", preset: "co2" })));
check("CO₂ 368 ppm = bom (--success-color)",
  fill(make({ entity: "sensor.co2_bom", preset: "co2" })) === "rgba(67, 160, 71, 0.45)");
check("TVOC 0,7 ppm = ruim (--error-color)",
  fill(make({ entity: "sensor.tvoc", preset: "tvoc" })) === "rgba(219, 68, 55, 0.45)");
check("formaldeído 0,02 mg/m³ = bom",
  fill(make({ entity: "sensor.hcho", preset: "hcho" })) === "rgba(67, 160, 71, 0.45)");
check("PM2.5 40 µg/m³ = ruim",
  fill(make({ entity: "sensor.pm25", preset: "pm25" })) === "rgba(219, 68, 55, 0.45)");

console.log("presets próprios:");
check("iluminância 31 lx pinta no meio da escala",
  /^rgba\(120, 160, 210/.test(fill(make({ entity: "sensor.lux", preset: "lux" }))),
  fill(make({ entity: "sensor.lux", preset: "lux" })));
check("bateria 15 % pinta de laranja",
  fill(make({ entity: "sensor.bateria", preset: "battery" })) === "rgba(255, 140, 0, 0.5)",
  fill(make({ entity: "sensor.bateria", preset: "battery" })));

console.log("preset: auto (device_class):");
check("auto acha temperatura",
  fill(make({ entity: "sensor.temp_cozinha" })) === "rgba(127, 255, 0, 0.5)");
check("auto acha CO₂",
  fill(make({ entity: "sensor.co2_escritorio" })) === "rgba(255, 166, 0, 0.45)");
check("auto em binary_sensor vira ligado/desligado",
  fill(make({ entity: "binary_sensor.porta" })) === "rgba(255, 193, 7, 0.45)");

console.log("presença (porte do presenca_sensor_style):");
check("ocupação vence movimento",
  fill(make({ preset: "presence", occupancy_entities: ["binary_sensor.ocup_sala"],
    motion_entities: ["binary_sensor.mov_cozinha"] })) === "rgba(255, 140, 0, 0.55)");
check("só movimento = azul claro",
  fill(make({ preset: "presence", motion_entities: ["binary_sensor.mov_cozinha"] }))
  === "rgba(135, 206, 250, 0.40)");
check("tudo livre = preto translúcido",
  fill(make({ preset: "presence", motion_entities: ["binary_sensor.mov_sala"] }))
  === "rgba(0, 0, 0, 0.20)");
check("todos os sensores quebrados = vinho (não passa por livre)",
  fill(make({ preset: "presence", motion_entities: ["binary_sensor.quebrado"] }))
  === "rgba(80, 0, 0, 0.45)");
check("sem sensor nenhum não afirma nada",
  fill(make({ preset: "presence" })) === "rgba(0, 0, 0, 0.20)");

console.log("sem leitura:");
check("indisponível tem cor própria",
  fill(make({ entity: "sensor.sumido", preset: "temperature" })) === "rgba(0, 0, 0, 0.30)");
check("indisponível mostra travessão, não 'unavailable'",
  text(make({ entity: "sensor.sumido", preset: "temperature" })) === "—",
  text(make({ entity: "sensor.sumido", preset: "temperature" })));
check("desconhecido pode ter cor separada",
  fill(make({ entity: "sensor.confuso", preset: "temperature", color_unknown: "rgba(1, 2, 3, 0.5)" }))
  === "rgba(1, 2, 3, 0.5)");
check("hide_unavailable esconde a área",
  make({ entity: "sensor.sumido", preset: "temperature", hide_unavailable: true })
    .className.includes("is-hidden"));

console.log("escala custom e degradê:");
const cust = make({
  entity: "sensor.pm25", preset: "custom",
  stops: [10, 50], colors: ["#43a047", "#ffa600", "#db4437"],
});
check("custom pega a faixa do meio", fill(cust) === "#ffa600", fill(cust));
const grad = make({ entity: "sensor.temp_cozinha", preset: "temperature", mode: "gradient" });
check("degradê devolve cor interpolada (≠ degrau)",
  /^rgba\(/.test(fill(grad)) && fill(grad) !== "rgba(127, 255, 0, 0.5)", fill(grad));
check("degradê no ar também interpola",
  /^rgba\(/.test(fill(make({ entity: "sensor.co2_escritorio", preset: "co2", mode: "gradient" }))));
let threwCustom = false;
try { make({ entity: "sensor.pm25", preset: "custom" }); } catch (e) { threwCustom = true; }
check("custom sem cores falha na hora", threwCustom);

console.log("texto:");
check("número no idioma do HA (vírgula decimal) e unidade da entidade",
  text(make({ entity: "sensor.temp_cozinha", preset: "temperature" })) === "23,4 °C",
  text(make({ entity: "sensor.temp_cozinha", preset: "temperature" })));
check("porcentagem cola no número, como o HA faz",
  text(make({ entity: "sensor.umid_cozinha", preset: "humidity" })) === "58,0%",
  text(make({ entity: "sensor.umid_cozinha", preset: "humidity" })));
check("display_precision da entidade manda nas casas",
  text(make({ entity: "sensor.com_precisao" })) === "23,46 °C",
  text(make({ entity: "sensor.com_precisao" })));
check("decimals do YAML vence tudo",
  text(make({ entity: "sensor.temp_cozinha", preset: "temperature", decimals: 0 })) === "23 °C");
check("unit: none tira a unidade",
  text(make({ entity: "sensor.temp_cozinha", preset: "temperature", unit: "none" })) === "23,4");
check("label fixo substitui o valor",
  text(make({ entity: "sensor.temp_cozinha", preset: "temperature", label: "COZINHA" })) === "COZINHA");
check("presença não escreve valor por padrão",
  text(make({ preset: "presence", motion_entities: ["binary_sensor.mov_cozinha"] })) === "");
check("atributo em vez do state",
  text(make({ entity: "sensor.com_atributo", preset: "pm25", attribute: "pm25" })) === "40 µg/m³",
  text(make({ entity: "sensor.com_atributo", preset: "pm25", attribute: "pm25" })));

console.log("geometria no host:");
const geo = make({
  entity: "sensor.temp_cozinha", preset: "temperature",
  left: "29%", top: "7%", width: "33%", height: "12%",
});
check("left/top/width/height vão para o host",
  geo.style.left === "29%" && geo.style.top === "7%"
  && geo.style.width === "33%" && geo.style.height === "12%");
check("âncora padrão é o canto (área, não bolinha)",
  geo.style.transform === undefined || geo.style.transform === "translate(0, 0)");
const cen = make({ entity: "sensor.temp_cozinha", anchor: "center", rotate: 90 });
check("âncora central e rotação compõem o transform",
  cen.style.transform === "translate(-50%, -50%) rotate(90deg)", cen.style.transform);

console.log("desempenho (o motivo de a planta não travar):");
const perf = make({ entity: "sensor.temp_cozinha", preset: "temperature" });
let renders = 0;
const realUpdate = perf._update.bind(perf);
perf._update = () => { renders += 1; realUpdate(); };
perf.hass = { ...hass };                      // outra entidade da casa mudou
perf.hass = { ...hass };
check("hass novo sem mudança na entidade vigiada não redesenha", renders === 0, String(renders));
const moved = { ...hass, states: { ...hass.states, "sensor.temp_cozinha": S(30, { unit_of_measurement: "°C", device_class: "temperature" }) } };
perf.hass = moved;
check("entidade vigiada mudou → redesenha", renders === 1, String(renders));
check("cor acompanhou a mudança (30 °C cai na faixa seguinte)",
  fill(perf) === "rgba(255, 99, 71, 0.5)", fill(perf));

console.log("ações:");
const act = make({ entity: "sensor.temp_cozinha", tap_action: "none" });
check("tap_action none deixa o cursor de leitura", act.style.cursor === "default");
check("tap padrão é ponteiro", make({ entity: "sensor.temp_cozinha" }).style.cursor === "pointer");
check("tooltip cai no friendly_name",
  make({ entity: "sensor.temp_cozinha" }).title === "Temperatura da Cozinha");
check("tooltip aceita name do YAML",
  make({ entity: "sensor.temp_cozinha", name: "🟨 COZINHA" }).title === "🟨 COZINHA");

let threw = false;
try { new reg["mw-state-color-element"]().setConfig({}); } catch (e) { threw = true; }
check("setConfig sem entity falha (fora de presence/none)", threw);
let threw2 = false;
try { new reg["mw-state-color-element"]().setConfig({ preset: "presence" }); } catch (e) { threw2 = true; }
check("preset presence dispensa entity", !threw2);

console.log("editor:");
const ed = new reg["mw-state-color-element-editor"]();
ed.setConfig({ entity: "sensor.temp_cozinha" });
ed.hass = hass;
check("editor monta o ha-form",
  ed.children.length === 1 && ed.children[0].tagName === "HA-FORM");
check("editor mostra os padrões em vigor",
  ed._form.data.preset === "auto" && ed._form.data.mode === "step"
  && ed._form.data.anchor === "top-left");
check("editor rotula em pt-BR",
  ed._form.computeLabel({ name: "preset" }) === "Escala");
const schema = JSON.stringify(ed._form.schema);
check("editor cobre entidade, escala, geometria, presença, custom e ações",
  ["entity", "preset", "width", "height", "occupancy_entities", "stops", "tap_action"]
    .every((k) => schema.includes(`"${k}"`)));
check("as 13 escalas estão no seletor",
  ["temperature", "humidity", "co2", "tvoc", "hcho", "pm25", "lux", "battery",
    "presence", "binary", "custom", "none", "auto"].every((k) => schema.includes(`"${k}"`)));
check("elemento oferece editor ao picture-elements",
  typeof reg["mw-state-color-element"].getConfigElement === "function"
  && reg["mw-state-color-element"].getConfigElement().tagName
    === "MW-STATE-COLOR-ELEMENT-EDITOR");
check("stub config traz o type",
  reg["mw-state-color-element"].getStubConfig().type === "custom:mw-state-color-element");

console.log("identidade no editor:");
const MW_PREFIX = "ui.panel.lovelace.editor.card.picture-elements.element_types.";
const MW_TYPE = "custom:mw-state-color-element";
check("elemento registrado no window.mwPictureElements",
  (global.window.mwPictureElements || []).some(
    (e) => e.type === MW_TYPE && e.name === "Área por estado"),
  JSON.stringify(global.window.mwPictureElements));
const hassId = { states: {}, localize: (k) => (k === "ui.common.delete" ? "Excluir" : "") };
new reg["mw-state-color-element"]().hass = hassId;
check("a lista mostra o nome amigável em vez do tipo cru",
  (hassId.localize(MW_PREFIX + MW_TYPE) || MW_TYPE) === "Área por estado",
  hassId.localize(MW_PREFIX + MW_TYPE));
check("tipo de terceiro continua cru",
  (hassId.localize(MW_PREFIX + "custom:outra-coisa") || "custom:outra-coisa")
  === "custom:outra-coisa");
check("chave de fora do prefixo passa intacta",
  hassId.localize("ui.common.delete") === "Excluir");

const mwSrc = fs.readFileSync(SRC, "utf8");
check("campo de título no schema do editor",
  mwSrc.split("MW_TITLE_FIELD").length - 1 >= 2,
  "MW_TITLE_FIELD tem de ser usado no SCHEMA, não só definido");
check("rótulo do título nos LABELS",
  mwSrc.split("MW_TITLE_LABEL").length - 1 >= 2);
check("os três blocos canônicos estão embutidos",
  ["mw-element-identity v1", "mw-climate-scale v1", "mw-air-quality-scale v1"]
    .every((m) => mwSrc.includes(`>>> ${m}`) && mwSrc.includes(`<<< ${m}`)));

console.log(fails ? `\n${fails} verificação(ões) falharam` : "\ntudo ok");
process.exit(fails ? 1 : 0);
