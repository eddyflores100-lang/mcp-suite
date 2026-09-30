#!/usr/bin/env node
/**
 * MCP Server: Locale Helper
 * Glossario y reglas de localización ES/EN/FR: formatos y consistencia terminológica
 *
 * Dolor que resuelve: El agente mezcla formatos de fecha/número entre idiomas y traduce términos clave inconsistentemente: el glossario vive en ninguna parte.
 * Categoría: Comunicación y Humano | Generado por mcp-suite | id: locale-helper
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
// ——— persistencia local: ~/.mcp-suite/locale-helper/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "locale-helper");
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
const server = new McpServer({ name: "locale-helper", version: "1.0.0" });
server.tool("add_glossary", "Añade términos al glossario multilingüe (es/en/fr) para traducciones consistentes.", {
    es: z.string().describe("Término en español"),
    en: z.string().describe("En inglés").optional(),
    fr: z.string().describe("En francés").optional(),
    nota: z.string().describe("Nota de uso").optional(),
}, async (args) => {
    const { es, en, fr, nota } = args;
    const st = store.load();
    st.glossario = st.glossario || [];
    st.glossario.push({ es, en: en || "", fr: fr || "", nota: nota || "" });
    store.save(st);
    return ok({ terminos: st.glossario.length });
});
server.tool("lookup_glossary", "Busca un término en el glossario y devuelve sus equivalentes + nota de uso.", {
    termino: z.string().describe("Término (cualquier idioma)"),
}, async (args) => {
    const { termino } = args;
    const st = store.load();
    const t = termino.toLowerCase().trim();
    const hit = (st.glossario || []).find((g) => [g.es, g.en, g.fr].some((v) => String(v).toLowerCase() === t));
    if (!hit)
        return ok({ encontrado: false, sugerencia: "agrégalo con add_glossary para consistencia futura" });
    return ok({ encontrado: true, ...hit });
});
server.tool("locale_rules", "Reglas de formato por locale: fechas, números, moneda y unidades (es-EC, es-ES, en-US, fr-CA, fr-FR).", {
    locale: z.enum(["es-EC", "es-ES", "es-MX", "en-US", "en-GB", "fr-CA", "fr-FR"]).describe("Locale"),
    ejemplo_fecha: z.string().describe("Fecha ISO a formatear").default("2026-09-10"),
}, async (args) => {
    const { locale, ejemplo_fecha } = args;
    const reglas = {
        "es-EC": { fecha: "10/09/2026", fecha_larga: "10 de septiembre de 2026", numero: "1.234,56", moneda: "$ 1.234,56 (USD)", decimal: ",", miles: "." },
        "es-ES": { fecha: "10/09/2026", fecha_larga: "10 de septiembre de 2026", numero: "1.234,56", moneda: "1.234,56 €", decimal: ",", miles: "." },
        "es-MX": { fecha: "10/09/2026", fecha_larga: "10 de septiembre de 2026", numero: "1,234.56", moneda: "$1,234.56 (MXN)", decimal: ".", miles: "," },
        "en-US": { fecha: "09/10/2026", fecha_larga: "September 10, 2026", numero: "1,234.56", moneda: "$1,234.56", decimal: ".", miles: "," },
        "en-GB": { fecha: "10/09/2026", fecha_larga: "10 September 2026", numero: "1,234.56", moneda: "£1,234.56", decimal: ".", miles: "," },
        "fr-CA": { fecha: "2026-09-10", fecha_larga: "10 septembre 2026", numero: "1 234,56", moneda: "1 234,56 $ CAD", decimal: ",", miles: " " },
        "fr-FR": { fecha: "10/09/2026", fecha_larga: "10 septembre 2026", numero: "1 234,56", moneda: "1 234,56 €", decimal: ",", miles: " " },
    };
    const r = reglas[locale] || reglas["es-EC"];
    return ok({ locale, ...r, ejemplo: "formato corto: " + r.fecha + " | largo: " + r.fecha_larga });
});
server.tool("health_check", "Verifica que el servidor locale-helper está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "locale-helper", tools: 4, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[locale-helper] fatal:", e);
    process.exit(1);
});
