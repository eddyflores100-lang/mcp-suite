#!/usr/bin/env node
import {readdirSync,existsSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const ROOT=dirname(dirname(fileURLToPath(import.meta.url)));
export function selectServers(root,only){
 const dirs=readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()&&d.name.startsWith('mcp-')).map(d=>d.name).filter(d=>!only||d===`mcp-${only}`).sort();
 if(!dirs.length)throw Error(only?`Unknown server: ${only}`:'No servers found');
 for(const dir of dirs)if(!existsSync(join(root,dir,'dist','index.js')))throw Error(`Missing build: ${dir}. Compile before testing.`);
 return dirs;
}
export function callServer(entry,{tool='health_check',args={},timeoutMs=12000,expectedServer}={}){
 return new Promise(resolveResult=>{
 const proc=spawn(process.execPath,[entry],{stdio:['pipe','pipe','pipe']});let buf='',done=false,phase=1,tools=[];
 const finish=result=>{if(done)return;done=true;clearTimeout(timer);proc.kill('SIGKILL');resolveResult(result);};
 const timer=setTimeout(()=>finish({ok:false,error:'MCP timeout'}),timeoutMs);
 const send=obj=>{if(!done)proc.stdin.write(JSON.stringify({jsonrpc:'2.0',...obj})+'\n');};
 proc.on('error',()=>finish({ok:false,error:'Unable to start server'}));proc.stdin.on('error',()=>finish({ok:false,error:'Server stdin closed'}));
 proc.stderr.on('data',()=>{}); // Do not expose arbitrary server logs or secrets.
 proc.on('exit',code=>finish({ok:false,error:`Server exited before completion (${code})`}));
 proc.stdout.setEncoding('utf8');
 proc.stdout.on('data',data=>{
 buf+=data.toString();if(buf.length>1024*1024)return finish({ok:false,error:'MCP output too large'});
 let nl;while(!done&&(nl=buf.indexOf('\n'))>=0){const line=buf.slice(0,nl).trim();buf=buf.slice(nl+1);if(!line)continue;
 let msg;try{msg=JSON.parse(line);}catch{return finish({ok:false,error:'Non-JSON stdout'});}
 if(!msg||typeof msg!=='object'||Array.isArray(msg))return finish({ok:false,error:'Invalid JSON-RPC message'});
 if(msg.id===undefined)continue;
 if(msg.jsonrpc!=='2.0'||msg.id!==phase||msg.error||!msg.result)return finish({ok:false,error:`Invalid/error response at phase ${phase}`});
 if(phase===1){if(!msg.result.protocolVersion||!msg.result.serverInfo?.name||!msg.result.capabilities)return finish({ok:false,error:'Invalid initialization'});phase=2;send({method:'notifications/initialized'});send({id:2,method:'tools/list'});}
 else if(phase===2){tools=msg.result.tools;if(!Array.isArray(tools)||!tools.length||tools.some(t=>!t||typeof t.name!=='string'||!t.inputSchema)||!tools.some(t=>t.name===tool))return finish({ok:false,error:'Invalid tool list or requested tool missing'});phase=3;send({id:3,method:'tools/call',params:{name:tool,arguments:args}});}
 else {if(msg.result.isError)return finish({ok:false,error:'Tool returned isError'});let payload;try{payload=JSON.parse(msg.result.content.find(c=>c.type==='text').text);}catch{return finish({ok:false,error:'Tool result is not JSON text'});}
 if(tool==='health_check'&&(payload?.ok!==true||payload.tools!==tools.length||(expectedServer&&payload.server!==expectedServer)))return finish({ok:false,error:'Invalid health payload'});
 finish({ok:true,toolCount:tools.length,data:payload});}
 }
 });
 send({id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'suite-verifier',version:'2.0.0'}}});
 });
}
async function main(){
 const args=process.argv.slice(2);const verbose=args.includes('--verbose');const filtered=args.filter(a=>a!=='--verbose');
 if(filtered.length&&!(filtered.length===2&&filtered[0]==='--only'&&/^[a-z0-9-]+$/.test(filtered[1])))throw Error('Usage: smoke.mjs [--only server-id] [--verbose]');
 const dirs=selectServers(join(ROOT,'servers'),filtered[1]);let index=0,failed=0;
 async function worker(){while(index<dirs.length){const dir=dirs[index++];const r=await callServer(join(ROOT,'servers',dir,'dist','index.js'),{expectedServer:dir.slice(4)});if(!r.ok){failed++;console.error(`FAIL ${dir}: ${r.error}`);}else if(verbose)console.log(`PASS ${dir}: ${r.toolCount} registered tools`);}}
 await Promise.all(Array.from({length:Math.min(12,dirs.length)},worker));console.log(`SMOKE: ${dirs.length-failed}/${dirs.length} handshake + health checks passed. This does not certify tool behavior.`);process.exitCode=failed?1:0;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
