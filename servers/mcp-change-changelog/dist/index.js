#!/usr/bin/env node
/**
 * MCP Server: Change Changelog
 * Changelog humano generado de los cambios del agente: agrupado, con semántica y exportable a Markdown
 *
 * Dolor que resuelve: El agente cambia 40 cosas en la semana y cuando alguien pregunta '¿qué cambió desde el martes?' la respuesta es un encogimiento de hombros digital: sin registro estructurado no hay changelog posible.
 * Categoría: Agent CI/CD | Generado por mcp-suite | id: change-changelog
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
// ——— persistencia local: ~/.mcp-suite/change-changelog/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "change-changelog");
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
const server = new McpServer({ name: "change-changelog", version: "1.0.0" });
server.tool("record_change", "Registra un cambio con tipo, componente y descripción orientada a humanos.", {
    tipo: z.enum(["added", "changed", "fixed", "removed", "deprecated", "security"]).describe("Naturaleza del cambio"),
    componente: z.string().describe("Qué se cambió (prompt:x, tool:y, config:z)"),
    descripcion: z.string().describe("Descripción en una línea, humana y específica"),
    impacto: z.enum(["nulo", "menor", "mayor", "rotura"]).describe("Impacto en comportamiento").default("menor"),
}, async (args) => {
    const { tipo, componente, descripcion, impacto } = args;
    const st = store.load();
    st.cambios = st.cambios || [];
    st.cambios.push({ tipo, componente, descripcion, impacto, ts: new Date().toISOString() });
    store.save(st);
    return ok({ registrado: true, cambios_totales: st.cambios.length, pendientes_de_release: st.cambios.filter(c => !c.release).length });
});
server.tool("tag_release", "Sella los cambios pendientes en una versión (etiqueta) con resumen.", {
    etiqueta: z.string().describe("Nombre de la versión (v1.4.0 o fecha)"),
}, async (args) => {
    const { etiqueta } = args;
    const st = store.load();
    st.cambios = st.cambios || [];
    const pendientes = st.cambios.filter(c => !c.release);
    if (!pendientes.length)
        return fail("no hay cambios pendientes de release");
    pendientes.forEach(c => { c.release = etiqueta; });
    store.save(st);
    const conteo = {};
    pendientes.forEach(c => { conteo[c.tipo] = (conteo[c.tipo] || 0) + 1; });
    const hayRotura = pendientes.some(c => c.impacto === "rotura");
    return ok({ etiqueta, cambios_sellados: pendientes.length, desglose: conteo, aviso_version: hayRotura ? "contiene cambios de RUTURA: bump MAJOR obligatorio y nota destacada" : "sin rupturas: bump menor/patch suficiente" });
});
server.tool("generate_changelog", "Genera el changelog agrupado por versión y tipo, listo para publicar.", {
    solo_release: z.string().describe("Filtrar por una versión concreta").optional(),
    limite: z.number().describe("Máximo de versiones a mostrar").default(5),
}, async (args) => {
    const { solo_release, limite } = args;
    const st = store.load();
    const cambios = st.cambios || [];
    if (!cambios.length)
        return fail("sin cambios registrados");
    let grupos = {};
    cambios.forEach(c => {
        const r = c.release || "SIN_RELEASE";
        grupos[r] = grupos[r] || {};
        grupos[r][c.tipo] = grupos[r][c.tipo] || [];
        grupos[r][c.tipo].push({ componente: c.componente, descripcion: c.descripcion, impacto: c.impacto, ts: c.ts });
    });
    let claves = Object.keys(grupos).filter(k => k !== "SIN_RELEASE");
    if (solo_release)
        claves = claves.filter(k => k === solo_release);
    const resultado = {};
    claves.slice(-limite).forEach(k => { resultado[k] = grupos[k]; });
    if (!solo_release && grupos["SIN_RELEASE"]?.added)
        resultado["PENDIENTE"] = grupos["SIN_RELEASE"];
    return ok({ versiones: claves.length, changelog: resultado, pendientes_sin_release: (grupos["SIN_RELEASE"] || {}).added ? (grupos["SIN_RELEASE"].added.length + (grupos["SIN_RELEASE"].changed || []).length + (grupos["SIN_RELEASE"].fixed || []).length) + " cambios sin sellar" : 0, siguiente: "usa markdown_export para llevártelo al README" });
});
server.tool("markdown_export", "Exporta el changelog como Markdown formato Keep-a-Changelog.", {
    titulo: z.string().describe("Título del proyecto").default("Changelog"),
    solo_release: z.string().describe("Versión concreta").optional(),
}, async (args) => {
    const { titulo, solo_release } = args;
    const st = store.load();
    const cambios = st.cambios || [];
    if (!cambios.length)
        return fail("sin cambios registrados");
    const etiquetas = { added: "Added", changed: "Changed", fixed: "Fixed", removed: "Removed", deprecated: "Deprecated", security: "Security" };
    const grupos = {};
    cambios.filter(c => !solo_release || c.release === solo_release).forEach(c => {
        const r = c.release || "Unreleased";
        grupos[r] = grupos[r] || {};
        grupos[r][c.tipo] = grupos[r][c.tipo] || [];
        grupos[r][c.tipo].push(c);
    });
    let md = "# " + titulo + "\n\n";
    Object.keys(grupos).reverse().forEach(r => {
        md += "## " + r + "\n";
        Object.keys(grupos[r]).forEach(t => {
            md += "### " + (etiquetas[t] || t) + "\n";
            grupos[r][t].forEach(c => {
                const marca = c.impacto === "rotura" ? " **[BREAKING]**" : c.impacto === "mayor" ? " *(mayor)*" : "";
                md += "- " + c.descripcion + marca + " (" + c.componente + ")\n";
            });
        });
        md += "\n";
    });
    return ok({ markdown: md, lineas: md.split("\n").length, cambios: cambios.length });
});
server.tool("health_check", "Verifica que el servidor change-changelog está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "change-changelog", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[change-changelog] fatal:", e);
    process.exit(1);
});
