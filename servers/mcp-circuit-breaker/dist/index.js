#!/usr/bin/env node
/**
 * MCP Server: Circuit Breaker
 * Disyuntor por servicio: deja de martillar lo que está caído
 *
 * Dolor que resuelve: Cuando un servicio MCP cae, cada llamada espera su timeout completo: cascada de latencia. Falta circuit breaker.
 * Categoría: Resiliencia de Tools | Generado por mcp-suite | id: circuit-breaker
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
// ——— persistencia local: ~/.mcp-suite/circuit-breaker/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "circuit-breaker");
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
const server = new McpServer({ name: "circuit-breaker", version: "1.0.0" });
server.tool("record_success", "Registra un éxito del servicio (resetea contador de fallos; cierra el circuito si estaba half-open).", {
    servicio: z.string().describe("Nombre del servicio"),
}, async (args) => {
    const { servicio } = args;
    const st = store.load();
    st.breakers = st.breakers || {};
    const b = st.breakers[servicio] = st.breakers[servicio] || { estado: "closed", fallos: 0, exitos: 0 };
    b.exitos = (b.exitos || 0) + 1;
    b.fallos = 0;
    if (b.estado === "half-open")
        b.estado = "closed";
    b.ultimo_evento = new Date().toISOString();
    store.save(st);
    return ok({ servicio, estado: b.estado });
});
server.tool("record_failure", "Registra un fallo del servicio: al llegar al umbral, el circuito se ABRE (bloquea llamadas).", {
    servicio: z.string().describe("Servicio"),
    umbral: z.number().describe("Fallos para abrir").default(5),
}, async (args) => {
    const { servicio, umbral } = args;
    const st = store.load();
    st.breakers = st.breakers || {};
    const b = st.breakers[servicio] = st.breakers[servicio] || { estado: "closed", fallos: 0, exitos: 0 };
    b.fallos = (b.fallos || 0) + 1;
    if (b.estado === "half-open" || b.fallos >= (umbral ?? 5)) {
        b.estado = "open";
        b.abierto = new Date().toISOString();
    }
    b.ultimo_evento = new Date().toISOString();
    store.save(st);
    return ok({ servicio, estado: b.estado, fallos_consecutivos: b.fallos });
});
server.tool("check", "Consulta el estado del circuito para un servicio: permite llamar (closed/half-open tras cooldown) o bloqueado (open).", {
    servicio: z.string().describe("Servicio"),
    cooldown_ms: z.number().describe("Cooldown antes de half-open").default(30000),
}, async (args) => {
    const { servicio, cooldown_ms } = args;
    const st = store.load();
    const b = st.breakers?.[servicio];
    if (!b)
        return ok({ servicio, estado: "closed", permitir: true, fallos: 0 });
    let estado = b.estado;
    let permitir = estado !== "open";
    if (estado === "open") {
        const desde = new Date(b.abierto || 0).getTime();
        if (Date.now() - desde >= (cooldown_ms ?? 30000)) {
            estado = "half-open";
            permitir = true;
        }
    }
    return ok({ servicio, estado, permitir, fallos_consecutivos: b.fallos, exitos: b.exitos, ultima: b.ultimo_evento });
});
server.tool("reset", "Resetea manualmente el circuito de un servicio (tras confirmar que volvió).", {
    servicio: z.string().describe("Servicio"),
}, async (args) => {
    const { servicio } = args;
    const st = store.load();
    if (st.breakers?.[servicio]) {
        st.breakers[servicio] = { estado: "closed", fallos: 0, exitos: 0 };
        store.save(st);
    }
    return ok({ servicio, reset: true });
});
server.tool("health_check", "Verifica que el servidor circuit-breaker está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "circuit-breaker", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[circuit-breaker] fatal:", e);
    process.exit(1);
});
