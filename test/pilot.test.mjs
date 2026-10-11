import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {callServer} from '../tools/smoke.mjs';
const cases=[
 ['safe-math','evaluate',{expresion:'(1250 - 320) * 0.15'},139.5],
 ['safe-math','evaluate',{expresion:'2*-3'},-6],
 ['safe-math','evaluate',{expresion:'2**3**2'},512],
 ['safe-math','evaluate',{expresion:'2**-2'},0.25],
 ['safe-math','evaluate',{expresion:'-2**2'},-4],
 ['safe-math','evaluate',{expresion:'.5+0.25'},0.75],
 ['safe-math','percent_change',{valor_inicial:100,valor_final:125},'25%','cambio_porcentual'],
 ['safe-math','rule_of_three',{a:2,b:10,c:4},20],
 ['json-toolkit','query',{data:{items:[{id:1},{id:2}]},path:'$.items[1].id'},2,'valor'],
 ['json-toolkit','query',{data:{},path:'$.missing'},false,'encontrado'],
 ['unit-convert','convert',{valor:100,de:'km',a:'mi'},100000/1609.344],
 ['unit-convert','convert',{valor:32,de:'f',a:'c'},0],
 ['unit-convert','convert',{valor:1,de:'KiB',a:'B'},1024],
 ['unit-convert','convert',{valor:1,de:'KB',a:'B'},1000],
 ['unit-convert','convert',{valor:1,de:'B',a:'GB'},1e-9],
];
for(const [id,tool,args,expected,key='resultado'] of cases)test(`${id}.${tool} ${JSON.stringify(args)}`,async()=>{
 const r=await callServer(fileURLToPath(new URL(`../servers/mcp-${id}/dist/index.js`,import.meta.url)),{tool,args});
 assert.equal(r.ok,true,JSON.stringify(r));assert.deepEqual(r.data[key],expected);
});
for(const expresion of ['1/0','1%0','(1+2','1+2)','1..2','process.exit()','2(3)','2+'])test(`math rejects ${expresion}`,async()=>{
 const r=await callServer(fileURLToPath(new URL('../servers/mcp-safe-math/dist/index.js',import.meta.url)),{tool:'evaluate',args:{expresion}});
 assert.equal(r.ok,false);assert.equal(r.error,'Tool returned isError');
});
test('conversion rejects incompatible families',async()=>{
 const r=await callServer(fileURLToPath(new URL('../servers/mcp-unit-convert/dist/index.js',import.meta.url)),{tool:'convert',args:{valor:1,de:'kg',a:'m'}});
 assert.equal(r.ok,false);assert.equal(r.error,'Tool returned isError');
});
