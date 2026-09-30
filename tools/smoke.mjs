#!/usr/bin/env node
/**
 * Smoke test: handshake MCP real sobre stdio para cada servidor.
 * initialize → initialized → tools/list → tools/call health_check
 */
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SERVERS = join(ROOT, "servers");
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const VERBOSE = args.includes("--verbose");

const dirs = readdirSync(SERVERS)
  .filter((d) => d.startsWith("mcp-") && existsSync(join(SERVERS, d, "dist", "index.js")) && (!only || d === `mcp-${only}`));

console.log(`🧪 smoke test sobre ${dirs.length} servidores compilados...`);

function send(ws, obj) { ws.stdin.write(JSON.stringify(obj) + "\n"); }

function smokeOne(dir) {
  return new Promise((resolve) => {
    const proc = spawn("node", [join(SERVERS, dir, "dist", "index.js")], { stdio: ["pipe", "pipe", "pipe"] });
    let buf = "";
    const responses = {};
    const timeout = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({ dir, ok: false, error: "timeout 12s" });
    }, 12000);

    const nextId = (() => { let i = 0; return () => ++i; })();

    const idInit = nextId();
    const idList = nextId();
    const idHealth = nextId();

    proc.stdout.on("data", (d) => {
      buf += d.toString();
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.id === idInit) {
          send(proc, { jsonrpc: "2.0", method: "notifications/initialized" });
          send(proc, { jsonrpc: "2.0", id: idList, method: "tools/list" });
        } else if (msg.id === idList) {
          responses.toolCount = msg?.result?.tools?.length ?? 0;
          responses.tools = (msg?.result?.tools || []).map((t) => t.name);
          send(proc, { jsonrpc: "2.0", id: idHealth, method: "tools/call", params: { name: "health_check", arguments: {} } });
        } else if (msg.id === idHealth) {
          responses.health = msg?.result?.content?.[0]?.text?.slice(0, 120) || "";
          clearTimeout(timeout);
          proc.kill();
          resolve({ dir, ok: true, ...responses });
        }
      }
    });

    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("exit", (code) => {
      clearTimeout(timeout);
      if (!responses.health) resolve({ dir, ok: false, error: stderr.slice(0, 200) || `exit ${code}` });
    });

    send(proc, {
      jsonrpc: "2.0", id: idInit, method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "smoke-tester", version: "1.0.0" },
      },
    });
  });
}

const CONCURRENCY = 12;
const results = [];
let idx = 0;
async function worker() {
  while (idx < dirs.length) {
    const dir = dirs[idx++];
    const r = await smokeOne(dir);
    results.push(r);
    if (r.ok) process.stdout.write(`✓ ${dir.replace("mcp-", "")}(${r.toolCount}t) `);
    else console.error(`\n✗ ${dir}: ${r.error}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

const okCount = results.filter((r) => r.ok).length;
const failCount = results.filter((r) => !r.ok).length;
const totalTools = results.reduce((a, r) => a + (r.toolCount || 0), 0);
console.log(`\n${failCount === 0 ? "✔" : "✗"} SMOKE: ${okCount}/${results.length} servidores OK, ${totalTools} tools registradas`);
if (VERBOSE) {
  for (const r of results.filter((r) => !r.ok)) console.log("FALLO:", r.dir, r.error);
}
process.exit(failCount === 0 ? 0 : 1);
