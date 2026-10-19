// Pruebas del bot de Telegram (cloudflare-worker/newar-bot.js). Se corren con:  node --test tests/
// Usan un índice de ejemplo (tests/fixture_bot_index.json) y un Telegram falso: no tocan Internet ni tu bot real.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const copia = path.join(os.tmpdir(), `newar-bot-${process.pid}.mjs`);      // se importa como módulo sin depender de la versión de Node
fs.copyFileSync(path.join(AQUI, "..", "cloudflare-worker", "newar-bot.js"), copia);
const W = await import(pathToFileURL(copia).href);
const worker = W.default;
const INDICE = fs.readFileSync(path.join(AQUI, "fixture_bot_index.json"), "utf8");
const ENV = { TELEGRAM_BOT_TOKEN: "123:ABC", WEBHOOK_SECRET: "clave_ok", ALLOWED_CHAT_IDS: "5" };
let llamadas = [];

globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url.includes("bot_index.json")) return new Response(INDICE);
  if (url.includes("news.google.com")) return new Response("<rss><channel></channel></rss>");
  if (url.includes("api.telegram.org")) llamadas.push([url.split("/").pop(), opt.body && typeof opt.body === "string" ? JSON.parse(opt.body) : {}]);
  return new Response('{"ok":true}');
};
const textos = () => llamadas.filter((l) => l[0] === "sendMessage").map((l) => l[1]);
const plano = (t) => t.replace(/<[^>]+>/g, "");
async function dice(texto, chat = 5) { llamadas = []; await W.atender(ENV, { message: { chat: { id: chat }, text: texto } }); return textos(); }

test("entiende 61 formas de preguntar (tests/preguntas.json)", () => {
  const casos = JSON.parse(fs.readFileSync(path.join(AQUI, "preguntas.json"), "utf8"));
  for (const [pregunta, esperado] of casos) {
    const r = W.entender(pregunta), o = r.o || {};
    for (const [k, v] of Object.entries(esperado)) {
      const real = k === "cmd" ? r.cmd : k === "arg" ? r.arg : k === "medioPosible" ? r.medioPosible : o[k];
      assert.equal(real, v, `«${pregunta}» → ${k}: esperado ${JSON.stringify(v)}, salió ${JSON.stringify(real)}`);
    }
  }
});

test("la búsqueda es precisa: «paro» no encuentra «parodia»; el plural sí; las largas buscan por comienzo", () => {
  assert.equal(W.coincide("el paro de transporte", "paro"), true);
  assert.equal(W.coincide("nuevos paros en la provincia", "paro"), true);
  assert.equal(W.coincide("una parodia de la serie", "paro"), false);
  assert.equal(W.coincide("jubilados reclaman", "jubilad"), true);
  assert.equal(W.coincide("ate convoco", "ate"), true);
  assert.equal(W.coincide("estado de la ruta", "ate"), false);
});

const H = (t, o = {}) => ({ t, f: t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9ñ]+/g, " ").trim(), m: ["Infobae"], mp: ["infobae"], n: 1, h: "10:00", d: "2026-10-12", a: "Política y gobierno", u: "https://ej.com/a", s: 0, p: [], ...o });
const IDX = (hs) => ({ historias: hs, fechas: ["2026-10-11", "2026-10-12"], medios: new Map([["infobae", "Infobae"], ["eltribuno", "El Tribuno"]]), personas: [] });

test("sinónimos: «huelga» encuentra «paro»; la frase tal cual rankea primero; «paro» no trae «parodia»", () => {
  const idx = IDX([H("Paro de transporte en Salta"), H("Huelga docente: sin clases"), H("Una parodia de la serie")]);
  assert.deepEqual(W.buscarHistorias(idx, "huelga").hits.map((h) => h.t).sort(), ["Huelga docente: sin clases", "Paro de transporte en Salta"]);
  assert.deepEqual(W.buscarHistorias(idx, "paro").hits.map((h) => h.t).sort(), ["Huelga docente: sin clases", "Paro de transporte en Salta"]);
  assert.ok(!W.buscarHistorias(idx, "paro").hits.some((h) => /parodia/.test(h.t)));
  assert.equal(W.buscarHistorias(idx, "paro de transporte").hits[0].t, "Paro de transporte en Salta");
});

test("filtros: por día, franja horaria, Salta y medio", () => {
  const idx = IDX([H("A hoy mañana", { h: "09:00" }), H("B hoy tarde", { h: "15:00", s: 1 }), H("C hoy noche", { h: "22:00" }),
    H("D ayer", { d: "2026-10-11", h: "11:00" }), H("E tribuno", { m: ["El Tribuno"], mp: ["eltribuno"], h: "16:00", s: 1 })]);
  const t = (o) => W.filtrar(idx, o).map((h) => h.t.split(" ")[0]).sort().join("");
  assert.equal(t({ dia: "ayer" }), "D");
  assert.equal(t({ dia: "hoy", franja: "manana" }), "A");
  assert.equal(t({ franja: "tarde" }), "BE");
  assert.equal(t({ franja: "noche" }), "C");
  assert.equal(t({ salta: true }), "BE");
  assert.equal(t({ medio: "El Tribuno" }), "E");
  assert.equal(W.filtrar(idx, { orden: "hora", dia: "hoy" })[0].t.startsWith("C"), true, "lo más reciente primero");
});

test("«en Salta» incluye notas que nombran a una autoridad provincial aunque el título no diga Salta", () => {
  const idx = IDX([H("PARO DOCENTE: reclaman a GUSTAVO SÁENZ", { p: ["gustavo-saenz"] }), H("Paro docente en Córdoba")]);
  idx.personas = [{ id: "gustavo-saenz", amb: "Provincial", c: "Gobernador de Salta", k: [] }];
  assert.deepEqual(W.filtrar(idx, { salta: true }).map((h) => h.t), ["PARO DOCENTE: reclaman a GUSTAVO SÁENZ"]);
  assert.equal(W.filtrar(IDX([H("Clima en Salta: lluvias")]), { salta: true }).length, 1);
});

test("«paro docente en Salta» encuentra la nota que nombra al gobernador (la búsqueda usa el mismo filtro que las listas)", () => {
  const idx = IDX([H("PARO DOCENTE: reclaman mejoras a GUSTAVO SÁENZ", { p: ["gustavo-saenz"] }), H("Paro docente en Córdoba")]);
  idx.personas = [{ id: "gustavo-saenz", amb: "Provincial", c: "Gobernador de Salta", k: [] }];
  const r = W.buscarHistorias(idx, "paro docente", { filtro: W.predicado(idx, { salta: true }) });
  assert.deepEqual(r.hits.map((h) => h.t), ["PARO DOCENTE: reclaman mejoras a GUSTAVO SÁENZ"]);
});

test("encuentra un medio por su nombre, con o sin artículo", () => {
  const idx = IDX([]);
  assert.equal(W.buscarMedio(idx, "El Tribuno"), "El Tribuno");
  assert.equal(W.buscarMedio(idx, "tribuno"), "El Tribuno");
  assert.equal(W.buscarMedio(idx, "infobae"), "Infobae");
  assert.equal(W.buscarMedio(idx, "dolar"), null);
});

test("/hoy lista noticias con números, medios y enlace", async () => {
  const [m] = await dice("qué pasó hoy");
  assert.match(m.text, /1️⃣/);
  assert.match(m.text, /<a href="https?:\/\//);
  assert.match(m.text, /<i>.*· \d{2}:\d{2}/);
  assert.ok(m.reply_markup.inline_keyboard.length >= 2, "lleva botones");
});

test("/economia solo trae notas de plata", async () => {
  const [m] = await dice("/economia");
  assert.match(plano(m.text), /Economía y finanzas/);
  assert.doesNotMatch(plano(m.text), /Lanús|Vélez/);
});

test("ficha de una persona: cargo, currículum con fuente y botón al panel", async () => {
  const [m] = await dice("quién es Sáenz");
  assert.match(plano(m.text), /Gustavo Sáenz/);
  assert.match(plano(m.text), /Gobernador de Salta/);
  assert.match(plano(m.text), /Currículum/);
  assert.ok(m.reply_markup.inline_keyboard.flat().some((b) => b.url && b.url.includes("#/persona/gustavo-saenz")));
});

test("nombre repetido: pregunta cuál", async () => {
  const [m] = await dice("Carlos");
  assert.match(plano(m.text), /Hay varias personas/);
});

test("nunca inventa: persona inexistente cae a búsqueda y lo aclara", async () => {
  const [m] = await dice("quién es Fulano Inexistente");
  assert.match(plano(m.text), /No tengo a «Fulano Inexistente»/);
});

test("un botón tocado funciona como el comando", async () => {
  llamadas = [];
  await W.atender(ENV, { callback_query: { id: "1", data: "/salta", message: { chat: { id: 5 } } } });
  assert.ok(llamadas.some((l) => l[0] === "answerCallbackQuery"));
  assert.match(plano(textos()[0].text), /En Salta/);
});

test("todos los botones respetan el límite de 64 bytes de Telegram", async () => {
  const bytes = new TextEncoder();
  for (const q of ["/hoy", "/salta", "quién es Sáenz", "/buscar dólar", "/ayuda", "/personas"]) {
    for (const t of await dice(q)) for (const b of (t.reply_markup?.inline_keyboard || []).flat()) if (b.callback_data) assert.ok(bytes.encode(b.callback_data).length <= 64, b.callback_data);
  }
});

test("es privado: un chat no autorizado no recibe datos", async () => {
  const [m] = await dice("qué pasó hoy", 999);
  assert.match(m.text, /privado/);
  assert.doesNotMatch(m.text, /Infobae|1️⃣/);
});

test("ningún mensaje supera el límite de Telegram ni corta un titular", async () => {
  const larga = Array.from({ length: 40 }, (_, i) => `• ${"Titular de prueba muy largo ".repeat(4)}${i}\n    <i>Infobae · 10:00</i>`).join("\n");
  const partes = W.partir(larga);
  assert.ok(partes.length > 1);
  for (const p of partes) { assert.ok(plano(p).length <= 3900); assert.ok(!p.startsWith("    ")); }
});

test("webhook: rechaza sin la clave secreta de Telegram", async () => {
  const cuerpo = JSON.stringify({ message: { chat: { id: 5 }, text: "/hoy" } });
  const ctx = { waitUntil: () => {} };
  const sin = await worker.fetch(new Request("https://x/webhook", { method: "POST", body: cuerpo }), ENV, ctx);
  assert.equal(sin.status, 401);
  const mala = await worker.fetch(new Request("https://x/webhook", { method: "POST", body: cuerpo, headers: { "X-Telegram-Bot-Api-Secret-Token": "otra" } }), ENV, ctx);
  assert.equal(mala.status, 401);
  const ok = await worker.fetch(new Request("https://x/webhook", { method: "POST", body: cuerpo, headers: { "X-Telegram-Bot-Api-Secret-Token": "clave_ok" } }), ENV, ctx);
  assert.equal(ok.status, 200);
});

test("/instalar pide la clave y no filtra el token", async () => {
  const sin = await worker.fetch(new Request("https://x/instalar"), ENV, {});
  assert.equal(sin.status, 403);
  const ok = await worker.fetch(new Request("https://x/instalar?clave=clave_ok"), ENV, {});
  const t = await ok.text();
  assert.equal(ok.status, 200);
  assert.doesNotMatch(t, /123:ABC/);
});

test("/personas: más nombrados, con botón a la ficha o a las noticias", async () => {
  const [m] = await dice("quiénes están en las noticias");
  const t = plano(m.text);
  assert.match(t, /Más nombrados hoy/);
  assert.match(t, /Javier Milei — 17 historias/);
  assert.match(t, /Gustavo Sáenz.*con ficha/);
  const cb = m.reply_markup.inline_keyboard.flat().map((b) => b.callback_data);
  assert.ok(cb.includes("/persona gustavo-saenz"), "la persona con ficha abre su ficha");
  assert.ok(cb.includes("/buscar Javier Milei"), "quien no tiene ficha abre las noticias");
  assert.equal((await dice("/personas")).length, 1);
});

test("errores de tipeo en un nombre: «Saens» se entiende como Sáenz", async () => {
  const [m] = await dice("quién es Saens");
  assert.match(plano(m.text), /Entendí «Saens» como «Gustavo Sáenz»/);
  assert.match(plano(m.text), /Gobernador de Salta/);
});

test("paginación: «Ver más» trae las siguientes y sigue numerando", async () => {
  const [m] = await dice("/hoy");
  const mas = m.reply_markup.inline_keyboard.flat().find((b) => /Ver más/.test(b.text));
  assert.ok(mas, "hay botón «Ver más»");
  assert.match(mas.callback_data, /^\/ver .*\+8$/);
  llamadas = [];
  await W.atender(ENV, { callback_query: { id: "9", data: mas.callback_data, message: { chat: { id: 5 } } } });
  assert.match(plano(textos()[0].text), /9️⃣|9\./);
});

test("¿de qué se habla? y ¿quién cubrió…? responden con conteos", async () => {
  const [t] = await dice("de qué se habla hoy");
  assert.match(plano(t.text), /De qué se habla hoy/);
  assert.match(plano(t.text), /Por área/);
  const [c] = await dice("quién cubrió el paro");
  assert.match(plano(c.text), /Cobertura de «el paro»|Cobertura de|No encontré historias/);
});

test("un día que no está en el índice: lo explica en vez de inventar", async () => {
  const [m] = await dice("qué pasó el 3 de octubre");
  assert.match(plano(m.text), /solo hoy y ayer/);
  assert.ok(m.reply_markup.inline_keyboard.flat().some((b) => b.url));
});

test("gracias, hola y ejemplos", async () => {
  assert.match(plano((await dice("gracias"))[0].text), /De nada/);
  assert.match(plano((await dice("hola"))[0].text), /Soy NEWAR/);
  assert.match(plano((await dice("ejemplos"))[0].text), /Probá preguntarme/);
});

test("/estado informa el índice", async () => {
  const [m] = await dice("/estado");
  assert.match(plano(m.text), /Estado de NEWAR/);
  assert.match(plano(m.text), /Historias: \d+/);
});
