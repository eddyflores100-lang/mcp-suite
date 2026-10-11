import {spawnSync} from 'node:child_process';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
for(const id of ['safe-math','json-toolkit','unit-convert']) {
 for(const args of [[join(root,'node_modules/typescript/bin/tsc'),'-p',join(root,'servers',`mcp-${id}`)], [join(root,'tools/smoke.mjs'),'--only',id]]) {
  const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});
  if(result.error||result.status!==0)process.exit(1);
 }
}
const test=spawnSync(process.execPath,['--test','test/smoke.test.mjs','test/generator.test.mjs','test/pilot.test.mjs'],{cwd:root,stdio:'inherit'});
process.exit(test.error?1:test.status??1);
