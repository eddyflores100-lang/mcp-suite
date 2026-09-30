#!/usr/bin/env node
/**
 * MCP Server: Checkpoint Undo
 * Checkpoints antes de acciones destructivas + rollback: el botón de 'deshacer' para agentes
 *
 * Dolor que resuelve: El agente borra una fila, envía un email o confirma un pago por error y no hay Ctrl+Z: el daño es irreversible porque ninguna acción destructiva fue precedida de checkpoint.
 * Categoría: Computer Use | Generado por mcp-suite | id: checkpoint-undo
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
// ——— persistencia local: ~/.mcp-suite/checkpoint-undo/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "checkpoint-undo");
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
const server = new McpServer({ name: "checkpoint-undo", version: "1.0.0" });
server.tool("gate_action", "Evalúa una acción ANTES de ejecutarla: nivel de riesgo y si exige checkpoint o confirmación humana.", {
    accion: z.string().describe("Acción contemplada"),
    contexto: z.string().describe("Dónde/sobre qué").optional(),
}, async (args) => {
    const { accion, contexto } = args;
    const CRITICAS = /(borrar|eliminar|delete|drop|enviar|submit|confirmar|pagar|payment|comprar|deploy|publicar|merge|sobrescribir|overwrite|reset|cerrar cuenta|cancelar)/i;
    const MODERADAS = /(escribir|editar|update|modificar|crear|nuevo|subir|upload|mover|mover|renombrar)/i;
    const texto = accion + " " + (contexto || "");
    let nivel, requisito;
    if (CRITICAS.test(texto)) {
        nivel = "destructivo";
        requisito = "checkpoint OBLIGATORIO + confirmación si toca datos de otros";
    }
    else if (MODERADAS.test(texto)) {
        nivel = "modificado";
        requisito = "checkpoint recomendado (barato de tomar)";
    }
    else {
        nivel = "lectura";
        requisito = "sin checkpoint";
    }
    return ok({ accion: accion.slice(0, 80), nivel, requisito, procede: nivel === "lectura" ? true : false, aviso: nivel === "destructivo" ? "NO ejecutes sin checkpoint previo (save_checkpoint) y plan de rollback" : null });
});
server.tool("save_checkpoint", "Graba un checkpoint de estado pre-acción: qué se va a tocar, estado previo y cómo deshacerlo.", {
    etiqueta: z.string().describe("Etiqueta del checkpoint"),
    accion_planned: z.string().describe("Acción destructiva que sigue"),
    estado_previo: z.any().describe("Estado serializable ANTES de actuar (valores, texto, flags)"),
    plan_rollback: z.string().describe("Cómo restaurar el estado_previo manualmente"),
}, async (args) => {
    const { etiqueta, accion_planned, estado_previo, plan_rollback } = args;
    const st = store.load();
    st.checkpoints = st.checkpoints || [];
    if (!plan_rollback)
        return fail("sin plan de rollback el checkpoint no sirve: ¿cómo se restaura el estado?");
    const cp = { n: st.checkpoints.length + 1, etiqueta, accion: accion_planned, estado_previo, plan_rollback, ts: new Date().toISOString(), restaurado: false };
    st.checkpoints.push(cp);
    if (st.checkpoints.length > 200)
        st.checkpoints = st.checkpoints.slice(-150);
    store.save(st);
    return ok({ checkpoint: cp.n, etiqueta, creado: true, ahora_puedes: "ejecuta la acción; si sale mal: restore(" + cp.n + ")" });
});
server.tool("restore", "Marca un checkpoint como restaurado y devuelve el estado previo + plan de rollback a ejecutar.", {
    n: z.number().describe("Número del checkpoint"),
    motivo: z.string().describe("Por qué se revierte").optional(),
}, async (args) => {
    const { n, motivo } = args;
    const st = store.load();
    const cp = (st.checkpoints || []).find(x => x.n === n);
    if (!cp)
        return fail("checkpoint inexistente");
    cp.restaurado = true;
    cp.restaurado_ts = new Date().toISOString();
    cp.motivo = motivo || null;
    store.save(st);
    return ok({ checkpoint: cp.n, etiqueta: cp.etiqueta, estado_previo: cp.estado_previo, plan_rollback: cp.plan_rollback, pasos: ["1. detén la acción en curso", "2. aplica el plan_rollback literal", "3. verifica contra estado_previo", "4. registra el fallo (failure-tagger) antes de reintentar"] });
});
server.tool("undo_stack", "Pila de checkpoints recientes (los no restaurados primero): el historial de puntos de retorno.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const cps = st.checkpoints || [];
    if (!cps.length)
        return ok({ checkpoints: 0 });
    const vivos = cps.filter(c => !c.restaurado).slice(-10).reverse();
    return ok({
        checkpoints: cps.length,
        restaurados: cps.length - vivos.length,
        puntos_de_retorno_vivos: vivos.map(c => ({ n: c.n, etiqueta: c.etiqueta, accion: c.accion.slice(0, 60), ts: c.ts })),
        ultimo_restaurado: [...cps].reverse().find(c => c.restaurado)?.etiqueta || null,
    });
});
server.tool("risk_stats", "Estadísticas de riesgo: acciones destructivas emprendidas, rollbacks necesarios y tasa de arrepentimiento.", {
// sin parámetros
}, async (args) => {
    const st = store.load();
    const cps = st.checkpoints || [];
    if (!cps.length)
        return ok({ checkpoints: 0, sugerencia: "toma checkpoints antes de acciones destructivas" });
    const restaurados = cps.filter(c => c.restaurado);
    return ok({
        checkpoints_totales: cps.length,
        acciones_destructivas_cubiertas: cps.length,
        rollbacks_ejecutados: restaurados.length,
        tasa_arrepentimiento: Number((restaurados.length / cps.length).toFixed(2)),
        veredicto: restaurados.length / cps.length > 0.4 ? "40%+ de acciones destructivas se revierten: el agente es demasiado agresivo, endurece gate_action" : "tasa de reversión razonable",
    });
});
server.tool("health_check", "Verifica que el servidor checkpoint-undo está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "checkpoint-undo", tools: 6, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[checkpoint-undo] fatal:", e);
    process.exit(1);
});
