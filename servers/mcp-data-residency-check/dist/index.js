#!/usr/bin/env node
/**
 * MCP Server: Data Residency Check
 * Verifica a dónde van los datos: restricciones de residencia geográfica y transferencias válidas
 *
 * Dolor que resuelve: El agente envía datos a APIs sin saber en qué país procesan: viola requisitos de residencia de datos (GDPR, soberanía) sin enterarse hasta la auditoría.
 * Categoría: Cumplimiento | Generado por mcp-suite | id: data-residency-check
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
// ——— helpers de respuesta ———
function ok(data) {
    return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}
function fail(msg) {
    return { content: [{ type: "text", text: typeof msg === "string" ? msg : JSON.stringify(msg) }], isError: true };
}
// ——— helpers de iteración tipados (evitan unknown[] de Object.values/entries) ———
function __vals(o) { return Object.values(o); }
function __ents(o) { return Object.entries(o); }
// ——— persistencia local: ~/.mcp-suite/data-residency-check/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "data-residency-check");
const STORE_FILE = join(STORE_DIR, "state.json");
const store = {
    load() {
        try {
            return existsSync(STORE_FILE) ? JSON.parse(readFileSync(STORE_FILE, "utf8")) : {};
        }
        catch {
            return {};
        }
    },
    save(data) {
        mkdirSync(STORE_DIR, { recursive: true });
        writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
        return data;
    },
};
const server = new McpServer({ name: "data-residency-check", version: "1.0.0" });
server.tool("register_destination", "Registra un destino de datos (API/servicio) con su jurisdicción y regiones de procesamiento.", {
    destino: z.string().describe("Nombre del servicio/API"),
    jurisdiccion: z.string().describe("País/jurisdicción principal (US, EU, CN, LOCAL...)"),
    regiones: z.array(z.any()).describe("Regiones donde procesa datos").default([]),
    nota: z.string().describe("Detalles del procesamiento").optional(),
}, async (args) => {
    const { destino, jurisdiccion, regiones, nota } = args;
    const st = store.load();
    st.destinos = st.destinos || {};
    st.destinos[destino] = { destino, jurisdiccion, regiones: regiones || [], nota: nota || null, registrado: new Date().toISOString() };
    store.save(st);
    return ok({ destino, jurisdiccion, regiones: (regiones || []).length });
});
server.tool("check_transfer", "Valida enviar un dato a un destino según su restricción de residencia.", {
    dato: z.string().describe("Tipo de dato (pii_ec, salud, financiero, anonimizado...)"),
    restriccion: z.enum(["sin_restriccion", "solo_local", "solo_ue", "no_cn", "no_us"]).describe("Restricción del dato"),
    destino: z.string().describe("Destino registrado"),
}, async (args) => {
    const { dato, restriccion, destino } = args;
    const st = store.load();
    const d = (st.destinos || {})[destino];
    if (!d)
        return fail("destino no registrado: usa register_destination");
    const j = d.jurisdiccion.toUpperCase();
    const REGIONES = (d.regiones || []).join(",").toUpperCase();
    let permitido = true, razon;
    switch (restriccion) {
        case "solo_local":
            permitido = j === "LOCAL" || j === "ONPREM";
            razon = permitido ? "procesamiento local" : "el dato exige procesamiento local y el destino es " + j;
            break;
        case "solo_ue":
            permitido = ["EU", "UE", "DE", "FR", "ES", "IE", "NL"].includes(j) || REGIONES.includes("EU");
            razon = permitido ? "dentro del espacio UE" : "dato con residencia UE enviado a " + j;
            break;
        case "no_cn":
            permitido = !["CN", "CHINA"].includes(j) && !REGIONES.includes("CN");
            razon = permitido ? "sin procesamiento en China" : "transferencia a China prohibida para este dato";
            break;
        case "no_us":
            permitido = !["US", "USA", "ESTADOS UNIDOS"].includes(j) && !REGIONES.includes("US");
            razon = permitido ? "sin procesamiento en US" : "transferencia a US prohibida (Schrems) para este dato";
            break;
        default: razon = "sin restricción de residencia";
    }
    st.transferencias = st.transferencias || [];
    st.transferencias.push({ dato, restriccion, destino, permitido, ts: new Date().toISOString() });
    store.save(st);
    return ok({ dato, destino: { jurisdiccion: d.jurisdiccion, regiones: d.regiones }, permitido, razon, accion: permitido ? "puedes enviar" : "NO envíes: busca destino alternativo o anonimiza antes (data-anonymizer)" });
});
server.tool("flow_map", "Mapa de flujos de datos: qué tipo de datos va a qué destinos y con qué estado de cumplimiento.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const trans = st.transferencias || [];
    if (!trans.length)
        return ok({ transferencias: 0, sugerencia: "valida transferencias con check_transfer" });
    const porDato = {};
    for (const t of trans) {
        porDato[t.dato] = porDato[t.dato] || { total: 0, permitidas: 0 };
        porDato[t.dato].total++;
        if (t.permitido)
            porDato[t.dato].permitidas++;
    }
    return ok({
        destinos_registrados: Object.keys(st.destinos || {}).length,
        transferencias_evaluadas: trans.length,
        violaciones: trans.filter(t => !t.permitido).length,
        por_tipo_de_dato: __ents(porDato).map(([k, v]) => ({ dato: k, transferencias: v.total, permitidas: v.permitidas })),
        violaciones_detalle: trans.filter(t => !t.permitido).slice(-5).map(t => ({ dato: t.dato, destino: t.destino, restriccion: t.restriccion })),
    });
});
server.tool("health_check", "Verifica que el servidor data-residency-check está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "data-residency-check", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[data-residency-check] fatal:", e);
    process.exit(1);
});
