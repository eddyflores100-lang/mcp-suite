#!/usr/bin/env node
/**
 * MCP Server: Tenant Data Tagger
 * Etiqueta cada dato con su inquilino y verifica que lo DERIVADO también la lleva: la etiqueta se propaga o no es confianza
 *
 * Dolor que resuelve: El dato original lleva tenant en su id, pero el resumen que el agente hizo de ese dato ya no lleva nada: al reutilizarlo para otro cliente, la fuga es perfecta porque la procedencia se evaporó.
 * Categoría: Multi-Tenant | Generado por mcp-suite | id: tenant-data-tagger
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
// ——— persistencia local: ~/.mcp-suite/tenant-data-tagger/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "tenant-data-tagger");
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
const server = new McpServer({ name: "tenant-data-tagger", version: "1.0.0" });
server.tool("tag_data", "Etiqueta un dato con su inquilino y clasificación de sensibilidad.", {
    dato: z.string().describe("Identificador del dato (ruta, id, clave de caché)"),
    tenant: z.string().describe("Inquilino dueño"),
    clasificacion: z.enum(["publico", "interno", "confidencial", "pii"]).describe("Sensibilidad").default("interno"),
    descripcion: z.string().describe("Qué contiene").optional(),
}, async (args) => {
    const { dato, tenant, clasificacion, descripcion } = args;
    const st = store.load();
    st.datos = st.datos || {};
    if (st.datos[dato])
        return fail("dato ya etiquetado como " + st.datos[dato].tenant + "/" + st.datos[dato].clasificacion + ": des-etiqueta conscientemente si cambia");
    st.datos[dato] = { dato, tenant, clasificacion, descripcion: descripcion || "", etiquetado: new Date().toISOString(), fuentes: null };
    store.save(st);
    return ok({ dato, tenant, clasificacion, regla: clasificacion === "pii" ? "PII: nunca sale del tenant ni a logs: redacta antes de cualquier salida" : "etiqueta registrada" });
});
server.tool("declare_derived", "Declara que un dato DERIVA de otros: la etiqueta debe heredarse del más sensible.", {
    dato_derivado: z.string().describe("Dato derivado (resumen, embedding, caché)"),
    fuentes: z.array(z.any()).describe("Ids de los datos de origen"),
}, async (args) => {
    const { dato_derivado, fuentes } = args;
    const st = store.load();
    st.datos = st.datos || {};
    const orden = { publico: 0, interno: 1, confidencial: 2, pii: 3 };
    const etiquetadas = (fuentes || []).map(f => st.datos[f]).filter(Boolean);
    if (!etiquetadas.length)
        return fail("ninguna fuente está etiquetada: etiquétalas primero, un derivado sin fuentes trazables es una fuga en potencia");
    const hereda = etiquetadas.reduce((max, f) => orden[f.clasificacion] > orden[max.clasificacion] ? f : max, etiquetadas[0]);
    st.datos[dato_derivado] = st.datos[dato_derivado] || { dato: dato_derivado, etiquetado: new Date().toISOString() };
    st.datos[dato_derivado].tenant = hereda.tenant;
    st.datos[dato_derivado].clasificacion = hereda.clasificacion;
    st.datos[dato_derivado].fuentes = (fuentes || []).map(String);
    st.datos[dato_derivado].descripcion = "derivado de " + fuentes.join(", ");
    store.save(st);
    return ok({ dato_derivado, hereda_de: fuentes, tenant_heredado: hereda.tenant, clasificacion_heredada: hereda.clasificacion, regla: "el derivado es TAN sensible como su fuente más sensible: sin degradar" });
});
server.tool("check_propagation", "Verifica la trazabilidad de un dato: ¿de dónde viene y conserva la etiqueta correcta?", {
    dato: z.string().describe("Dato a verificar"),
}, async (args) => {
    const { dato } = args;
    const st = store.load();
    const d = (st.datos || {})[dato];
    if (!d)
        return fail("dato sin etiquetar: etiquétalo antes de usarlo en nada");
    const camino = [d];
    let actual = d;
    while (actual.fuentes && actual.fuentes.length) {
        const primera = st.datos[actual.fuentes[0]];
        if (!primera) {
            camino.push({ roto: true, falta: actual.fuentes[0] });
            break;
        }
        camino.push(primera);
        actual = primera;
    }
    const roto = camino.some(c => c.roto);
    const consistente = !roto && camino.every(c => c.tenant === d.tenant);
    return ok({ dato, tenant: d.tenant, clasificacion: d.clasificacion, cadena_de_procedencia: camino.map(c => c.roto ? "FALTA: " + c.falta : c.dato + " [" + c.tenant + "/" + c.clasificacion + "]"), trazable: !roto, etiqueta_consistente_en_cadena: consistente, problema: roto ? "cadena ROTA: hay una fuente sin etiqueta: el dato no es confiable para uso cruzado" : consistente ? "todo en orden" : "INCONSISTENTE: la cadena mezcla tenants: revisa qué fuente se coló" });
});
server.tool("untagged_scan", "Escanea un conjunto de ids de datos y devuelve los que están sin etiqueta (puntos de fuga).", {
    candidatos: z.array(z.any()).describe("Ids de datos que el agente quiere usar ahora"),
}, async (args) => {
    const { candidatos } = args;
    const st = store.load();
    const datos = st.datos || {};
    const ids = (candidatos || []).map(String).filter(Boolean);
    if (!ids.length)
        return fail("sin candidatos");
    const sinEtiqueta = ids.filter(id => !datos[id]);
    const pii = ids.filter(id => datos[id] && datos[id].clasificacion === "pii");
    const confidenciales = ids.filter(id => datos[id] && datos[id].clasificacion === "confidencial");
    return ok({ candidatos: ids.length, sin_etiqueta: sinEtiqueta, con_pii: pii, confidenciales: confidenciales, veredicto: sinEtiqueta.length === 0 ? "todos etiquetados: uso trazable" : sinEtiqueta.length + " datos SIN etiqueta: etiquétalos o descártalos ANTES de usarlos; un dato sin tenant es de nadie y de todos (fuga potencial)" });
});
server.tool("health_check", "Verifica que el servidor tenant-data-tagger está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "tenant-data-tagger", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[tenant-data-tagger] fatal:", e);
    process.exit(1);
});
