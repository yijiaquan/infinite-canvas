import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const token=process.env.DRAMA_IMPORT_TOKEN;if(!token)throw new Error('Missing account');
const journal=JSON.parse(await fs.readFile('data/import-wfyx/journal-2cb77a8e07f3bac10dda175872720a4fc2d74d4af1617c7c1dbe94aa7748c536.json','utf8'));
const id=journal.steps.episode.value.canvasId;
async function api(route,data){const response=await fetch('http://127.0.0.1:8080/api/v1'+route,{method:data?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});const result=await response.json();assert.equal(result.code,0,result.msg);return result.data;}
const canvas=(await api('/canvas/projects')).find(c=>c.id===id);assert.ok(canvas);assert.equal(canvas.nodes.filter(n=>n.metadata?.dramaRole==='group').length,19);
await fs.mkdir('data/acceptance-local',{recursive:true});await fs.writeFile('data/acceptance-local/before-test-layout.json',JSON.stringify(canvas));
let top=0;
for(const clipId of canvas.dramaPreparedClipIds){const group=canvas.nodes.find(n=>n.metadata?.dramaClipId===clipId&&n.metadata.dramaRole==='group');const children=canvas.nodes.filter(n=>n.metadata?.dramaClipId===clipId&&n!==group);const refs=children.filter(n=>n.metadata.dramaRole==='reference');group.position={x:0,y:top};group.height=refs.length?330+Math.ceil(refs.length/3)*180:300;
 for(const node of children){if(node.metadata.dramaRole==='reference'){const index=refs.indexOf(node);node.position={x:24+(index%3)*236,y:top+300+Math.floor(index/3)*180};}else node.position={x:node.metadata.dramaRole==='video'?396:24,y:top+60};}
 top+=group.height+160;
}
const saved=await api('/canvas/projects',{data:{...canvas,viewport:{x:100,y:100,k:1},updatedAt:new Date().toISOString()}});
console.log(JSON.stringify({canvasId:id,revision:saved.dramaRevision,groups:19,layoutUpdated:true}));
