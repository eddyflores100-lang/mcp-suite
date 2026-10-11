import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('selective generation preserves other servers and global catalog',()=>{
 const root=mkdtempSync(join(tmpdir(),'mcp-generator-'));
 try {
  cpSync(fileURLToPath(new URL('../tools',import.meta.url)),join(root,'tools'),{recursive:true});
  mkdirSync(join(root,'servers/mcp-untouched'),{recursive:true});
  writeFileSync(join(root,'servers/mcp-untouched/marker'),'keep');writeFileSync(join(root,'catalog.json'),'keep catalog');
  for(const args of [['--only'],['--unknown'],['--only','--check']]) {
   const invalid=spawnSync(process.execPath,[join(root,'tools/generator.mjs'),...args]);
   assert.equal(invalid.status,1);assert.deepEqual(readdirSync(join(root,'servers')),['mcp-untouched']);
  }
  const result=spawnSync(process.execPath,[join(root,'tools/generator.mjs'),'--only','safe-math'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(readdirSync(join(root,'servers')).sort(),['mcp-safe-math','mcp-untouched']);
  assert.equal(readFileSync(join(root,'catalog.json'),'utf8'),'keep catalog');
  assert.equal(readFileSync(join(root,'servers/mcp-untouched/marker'),'utf8'),'keep');
 } finally {rmSync(root,{recursive:true,force:true});}
});
