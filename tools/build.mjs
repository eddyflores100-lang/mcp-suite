#!/usr/bin/env node
/** Compila todos los servidores (dist/) con concurrencia limitada */
import { readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SERVERS = join(ROOT, "servers");
const args = process.argv.slice(2);
if (args.length && !(args.length === 2 && args[0] === "--only" && /^[a-z0-9-]+$/.test(args[1]))) {
  console.error("Usage: build.mjs [--only server-id]"); process.exit(1);
}
const only = args[1];

const dirs = readdirSync(SERVERS).filter((d) => d.startsWith("mcp-") && (!only || d === `mcp-${only}`));
if (!dirs.length) { console.error("No matching servers"); process.exit(1); }
console.log(`🔨 compilando ${dirs.length} servidores...`);

const CONCURRENCY = 8;
let idx = 0, failed = 0;
const results = [];

async function worker() {
  while (idx < dirs.length) {
    const dir = dirs[idx++];
    const tsc = spawn(process.execPath, [join(ROOT, "node_modules/typescript/bin/tsc"), "-p", "."], { cwd: join(SERVERS, dir), stdio: "pipe" });
    let stderr = "";
    tsc.stderr.on("data", (d) => (stderr += d.toString()));
    tsc.stdout.on("data", (d) => (stderr += d.toString()));
    const code = await new Promise((res) => { tsc.on("close", res); tsc.on("error", () => res(1)); });
    if (code !== 0) {
      failed++;
      results.push({ dir, ok: false, error: stderr.slice(0, 500) });
      console.error(`✗ ${dir}: tsc exit ${code}\n${stderr.slice(0, 800)}`);
    } else {
      results.push({ dir, ok: true });
      process.stdout.write(`✓ ${dir}  `);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
console.log(`\n${failed === 0 ? "✔ build OK" : `✗ ${failed} fallos`} — ${dirs.length - failed}/${dirs.length} compilados`);
process.exit(failed === 0 ? 0 : 1);
