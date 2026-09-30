#!/usr/bin/env node
/**
 * MCP Server: Reversibility Planner
 * Clasifica cada acción del plan en reversible / compensable / irreversible y decide dónde poner checkpoints
 *
 * Dolor que resuelve: El agente encadena 20 acciones sin darse cuenta de que la número 7 era irreversible: cuando el resultado final no gusta, ya no hay vuelta atrás. Nadie le enseñó a clasificar reversibilidad ANTES de empezar.
 * Categoría: Pre-Vuelo | Generado por mcp-suite | id: reversibility-planner
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
// ——— persistencia local: ~/.mcp-suite/reversibility-planner/state.json ———
const STORE_DIR = join(homedir(), ".mcp-suite", "reversibility-planner");
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
const server = new McpServer({ name: "reversibility-planner", version: "1.0.0" });
server.tool("classify_action", "Clasifica una acción por reglas (verbos, recursos, cantidad de afectados) en reversible/compensable/irreversible con explicación.", {
    accion: z.string().describe("Descripción de la acción a clasificar"),
    recurso: z.string().describe("Recurso principal que toca").optional(),
    afectados: z.number().describe("Número de registros/usuarios afectados").default(1),
}, async (args) => {
    const { accion, recurso, afectados } = args;
    const texto = accion.toLowerCase();
    const patrones = [
        { re: /\b(drop|truncate|delete|borrar|eliminar|purge|shred|destruir)\b/, clase: "irreversible", porque: "verbo destructivo: el dato deja de existir" },
        { re: /\b(send|enviar|publicar|publish|post|tweet|email|notificar|facturar|pagar|transferir)\b/, clase: "compensable", porque: "efecto externo ya emitido: no se deshace, se compensa (disculpa, abono, corrección)" },
        { re: /\b(update|modificar|actualizar|cambiar|set)\b/, clase: "reversible", porque: "sobrescribe estado previo: se revierte restaurando el valor anterior" },
        { re: /\b(create|crear|insert|añadir|registrar)\b/, clase: "reversible", porque: "añadir sin romper: se revierte eliminando lo creado" },
        { re: /\b(grant|permiso|acceso|credencial|rol)\b/, clase: "compensable", porque: "permiso otorgado puede ser revocado, pero el uso hecho mientras tanto no" },
        { re: /\b(merge|fusionar|comprimir|compactar|migrar)\b/, clase: "irreversible", porque: "colapsa información distinguishable: restaurar exige reconstrucción externa" }
    ];
    let hit = patrones.find(p => p.re.test(texto));
    let clase = hit ? hit.clase : "revisar_manualmente";
    let porque = hit ? hit.porque : "ningún patrón de la taxonomía encaja: clasifícalo manualmente con teach_rule";
    if (afectados > 1000 && clase === "reversible") {
        clase = "compensable";
        porque = porque + " (escala de " + afectados + " afectados: la reversión técnica es posible pero el impacto ya ocurrió)";
    }
    return ok({ accion, recurso: recurso || "(no indicado)", afectados, clase, porque, recomendacion: clase === "irreversible" ? "PIDE APROBACIÓN + snapshot previo + dry-run obligatorio" : clase === "compensable" ? "registra efecto en side-effect-ledger y prepara la compensación ANTES de ejecutar" : "captura el valor previo para revertir en un paso" });
});
server.tool("teach_rule", "Enseña una regla de clasificación permanente (persiste entre sesiones).", {
    patron: z.string().describe("Patrón (texto o verbo) que dispara la regla"),
    clase: z.enum(["reversible", "compensable", "irreversible", "revisar_manualmente"]).describe("Clase de reversibilidad"),
    porque: z.string().describe("Razón de la regla"),
}, async (args) => {
    const { patron, clase, porque } = args;
    const st = store.load();
    st.reglas = st.reglas || [];
    const yaExiste = st.reglas.some(r => r.patron === patron);
    if (yaExiste)
        return fail("regla ya existente para ese patrón");
    st.reglas.push({ patron: patron.toLowerCase(), clase, porque, creada: new Date().toISOString() });
    store.save(st);
    return ok({ regla: patron, clase, total_reglas: st.reglas.length });
});
server.tool("compensation_plan", "Para acciones compensables/irreversibles: genera esqueleto de plan de compensación con partes obligatorias.", {
    accion: z.string().describe("Acción a compensar"),
    afectados: z.string().describe("Quién/qué resultó afectado").optional(),
    canal: z.string().describe("Canal del daño (email, público, datos, dinero)").optional(),
}, async (args) => {
    const { accion, afectados, canal } = args;
    const st = store.load();
    const clase = classifyLocal(accion);
    function classifyLocal(a) {
        const t = a.toLowerCase();
        const reglas = (st.reglas || []);
        for (const r of reglas)
            if (t.includes(r.patron))
                return r.clase;
        if (/\b(pagar|transfer|factur|abon)\w*/.test(t))
            return "compensable";
        if (/\b(delete|drop|borrar|eliminar)\w*/.test(t))
            return "irreversible";
        return "compensable";
    }
    const esDinero = /pagar|transfer|factur|abon|refund|dinero|pago/i.test(accion + " " + (canal || ""));
    const esPublico = /public|tweet|post|anunci|email|notific/i.test(accion + " " + (canal || ""));
    const partes = [
        { parte: "contención", obligatoria: true, acciones: ["detén la acción que sigue emitiendo efectos", "congela el estado actual para evitar más daño"] },
        { parte: "evaluación", obligatoria: true, acciones: ["cuantifica el daño real (" + (afectados || "afectados por identificar") + ")", "clasifica severidad: cosmético / funcional / financiero / reputacional"] },
        esDinero ? { parte: "restitución económica", obligatoria: true, acciones: ["calcula el importe exacto por afectado", "emite abono/reembolso con referencia del error", "verifica la entrada contable"] } : null,
        esPublico ? { parte: "comunicación", obligatoria: true, acciones: ["redacta corrección breve y factual (sin excusas largas)", "publícala por el mismo canal del daño original", "deja registro de alcance de la corrección"] } : null,
        { parte: "prevención", obligatoria: false, acciones: ["añade precondition que habría detectado esto", "clasifica la acción raíz con teach_rule para no repetirla"] }
    ].filter(Boolean);
    return ok({ accion, clase_actual: clase, plan_compensacion: partes, nota: "la compensación NO borra el efecto: lo contrarresta. Ejecuta contención hoy, evaluación antes de comunicar." });
});
server.tool("checkpoint_decision", "Dado un plan (lista de clases de acción), decide en qué puntos capturar snapshots: solo antes de puntos de no-retorno.", {
    plan: z.string().describe("Nombre del plan"),
    secuencia: z.array(z.any()).describe("Acciones del plan en orden (texto libre)"),
}, async (args) => {
    const { plan, secuencia } = args;
    const st = store.load();
    const pasos = (secuencia || []).map(String);
    if (!pasos.length)
        return fail("secuencia vacía");
    let puntosNoRetorno = 0;
    const decisiones = pasos.map((a, i) => {
        const t = a.toLowerCase();
        const irreversible = /\b(drop|delete|truncate|borrar|eliminar|merge|fusionar|migrar)\b/.test(t) || (st.reglas || []).some(r => r.clase === "irreversible" && t.includes(r.patron));
        const compensable = /\b(enviar|send|publicar|pagar|notificar|grant)\b/.test(t) || (st.reglas || []).some(r => r.clase === "compensable" && t.includes(r.patron));
        if (irreversible)
            puntosNoRetorno++;
        return { paso: i + 1, accion: a.slice(0, 60), checkpoint: irreversible || compensable ? "SI: snapshot ANTES de este paso" : "no", razon: irreversible ? "punto de no-retorno" : compensable ? "efecto externo: captura evidencia previa" : "reversible: el snapshot previo cercano cubre" };
    });
    const costeSnapshot = 1;
    return ok({ plan, pasos: pasos.length, puntos_de_no_retorno: puntosNoRetorno, checkpoints_recomendados: decisiones.filter(d => d.checkpoint !== "no").length, decisiones, presupuesto: "con snapshots selectivos pagas " + decisiones.filter(d => d.checkpoint !== "no").length * costeSnapshot + " unidades vs " + pasos.length + " si fotografiaras todo" });
});
server.tool("health_check", "Verifica que el servidor reversibility-planner está vivo: devuelve estado, número de tools y timestamp. Úsalo para diagnósticos.", {}, async () => ok({ ok: true, server: "reversibility-planner", tools: 5, ts: new Date().toISOString() }));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("[reversibility-planner] fatal:", e);
    process.exit(1);
});
