#!/usr/bin/env node
/** Compila todos los servidores (dist/) con concurrencia limitada */
import { readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SERVERS = join(ROOT, "servers");
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

const dirs = readdirSync(SERVERS).filter((d) => d.startsWith("mcp-") && (!only || d === `mcp-${only}`));
console.log(`🔨 compilando ${dirs.length} servidores...`);

const CONCURRENCY = 8;
let idx = 0, failed = 0;
const results = [];

async function worker() {
  while (idx < dirs.length) {
    const dir = dirs[idx++];
    const tsc = spawn("npx", ["tsc", "-p", "."], { cwd: join(SERVERS, dir), stdio: "pipe" });
    let stderr = "";
    tsc.stderr.on("data", (d) => (stderr += d.toString()));
    const code = await new Promise((res) => tsc.on("close", res));
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
