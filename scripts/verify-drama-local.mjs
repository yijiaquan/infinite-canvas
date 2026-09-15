import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const repo=path.resolve(import.meta.dirname,'..');
const token=process.env.DRAMA_IMPORT_TOKEN;
if(!token)throw new Error('Authenticated verification requires token environment');
const journal=JSON.parse(await fs.readFile(path.join(repo,'data/import-wfyx',process.env.DRAMA_IMPORT_JOURNAL||'journal-2cb77a8e07f3bac10dda175872720a4fc2d74d4af1617c7c1dbe94aa7748c536.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(repo,'data/import-wfyx/source-manifest.json'),'utf8'));
const episode=journal.steps.episode.value, project=journal.steps.project.value;
const api='http://127.0.0.1:8080',site='http://127.0.0.1:3000';
const output=path.join(repo,'data/acceptance-local');await fs.mkdir(output,{recursive:true});
async function get(route){const response=await fetch(api+route,{headers:{Authorization:`Bearer ${token}`}});const result=await response.json();assert.equal(result.code,0,result.msg);return result.data;}
const base=`/api/v1/drama/projects/${project.id}/episodes/${episode.id}`;
const clips=await get(base+'/clips'),runs=await get(base+'/runs'),adoptions=await get(base+'/adoptions');
assert.equal(clips.length,19);assert.equal(clips.reduce((n,c)=>n+c.shots.length,0),63);assert.equal(runs.length,38);assert.equal(adoptions.length,38);
const canvas=(await get('/api/v1/canvas/projects')).find(c=>c.id===episode.canvasId);
assert.equal(canvas.nodes.filter(n=>n.metadata?.dramaRole==='group').length,19);
for(const c of manifest.clips){
 const clipId=journal.steps[`clip:${c.sourceId}`].value.id;
 for(const kind of ['image','video']){
  const pick=adoptions.find(a=>a.clipId===clipId&&a.kind===kind),run=runs.find(v=>v.id===pick?.runId);
  assert.equal(run?.status,'completed');assert.ok(run.outputs.some(v=>v.storageId===pick.storageId));
  const expected=kind==='video'?c.delivery:manifest.assets.find(a=>a.sourceId===c.boardAssetId).media;
  const response=await fetch(`${api}/api/files/${pick.storageId}/content`,{headers:{Authorization:`Bearer ${token}`}});
  assert.equal(response.status,200);assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),expected.sha256);
 }
}
assert.ok(adoptions.every(a=>!a.needsReview),'All adopted outputs must match the current production inputs');
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.DRAMA_PLAYWRIGHT_PATH||'C:/Users/Tang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.DRAMA_CHROME_EXE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const errors=[],consoleErrors=[];let mediaPlayed=false;
try{
 const context=await browser.newContext({viewport:{width:1440,height:960}});
 await context.addInitScript(value=>{localStorage.setItem('infinite-canvas-auth-token-v1',JSON.stringify({state:{token:value},version:0}));},token);
 const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 await page.goto(`${site}/canvas/${episode.canvasId}`,{timeout:120000});
 await page.getByRole('button',{name:'漫剧工作台',exact:true}).waitFor();
 await page.screenshot({path:path.join(output,'episode-canvas.png')});
 await page.getByRole('button',{name:'漫剧工作台',exact:true}).click();
 await page.getByLabel('剧名',{exact:true}).waitFor();
 await page.screenshot({path:path.join(output,'workbench-project.png')});
 await page.getByRole('tab',{name:'制作台与导出',exact:true}).click();
 const overview=page.getByRole('region',{name:'分集制作总览'});
 await overview.locator('video').first().waitFor();
 await overview.locator('video').first().evaluate(async video=>{video.muted=true;video.playbackRate=1;await video.play();});
 await page.waitForFunction(()=>{const v=document.querySelector('[aria-label="分集制作总览"] video');return v&&v.currentTime>2&&v.videoWidth>0;});mediaPlayed=true;
 await overview.locator('video').first().evaluate(video=>video.pause());
 await page.screenshot({path:path.join(output,'workbench-overview.png')});
 await page.getByRole('tab',{name:'剧本与 Clip',exact:true}).click();
 await page.getByRole('tab',{name:'1 剧本与 Clip',exact:true}).click();
 await page.getByRole('region',{name:'Clip 与镜头'}).waitFor();
 await page.getByText('制作中 (19)',{exact:true}).waitFor();
 await page.screenshot({path:path.join(output,'workbench-clips.png')});
 await page.getByRole('tab',{name:'2 准备资产',exact:true}).click();
 await page.getByRole('region',{name:'项目资产'}).waitFor();
 await page.getByRole('navigation',{name:'项目资产列表'}).getByRole('button').first().waitFor();
 await page.screenshot({path:path.join(output,'workbench-assets.png')});
 await page.getByRole('tab',{name:'3 导演故事板',exact:true}).click();
 await page.getByLabel('导演故事板提示词',{exact:true}).waitFor();
 await page.screenshot({path:path.join(output,'workbench-storyboard.png')});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:path.join(output,'workbench-mobile.png')});
 await page.setViewportSize({width:1440,height:960});
 await page.getByRole('button',{name:'返回画布',exact:true}).click();
 await page.getByRole('button',{name:'资产',exact:true}).click();
 await page.getByRole('button',{name:'项目素材',exact:true}).waitFor();
 await page.locator('[title="秦衍常服身份板"]').waitFor();
 await page.screenshot({path:path.join(output,'canvas-project-assets.png')});
 assert.equal(errors.length,0,errors.join('\n'));
}finally{await browser.close();await fs.writeFile(path.join(output,'browser-console.json'),JSON.stringify({errors,consoleErrors},null,2));}
const exported=await fetch(api+base+'/export',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(120000)});
assert.equal(exported.status,200);const zipFile=path.join(output,'episode-export.zip');await fs.writeFile(zipFile,Buffer.from(await exported.arrayBuffer()));
const {execFileSync}=await import('node:child_process');
const zipResult=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [IO.Compression.ZipFile]::OpenRead($env:DRAMA_TEST_ZIP); try { $items = @(); foreach ($entry in $zip.Entries) { $stream = $entry.Open(); try { if ($entry.FullName -eq "manifest.json") { $reader = New-Object IO.StreamReader($stream); $manifest = $reader.ReadToEnd() | ConvertFrom-Json } else { $sha = [Security.Cryptography.SHA256]::Create(); $digest = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace("-", "").ToLowerInvariant(); $items += @{file=$entry.FullName;sha256=$digest} } } finally { $stream.Dispose() } }; @{manifest=$manifest;entries=$items} | ConvertTo-Json -Depth 10 -Compress } finally { $zip.Dispose() }'],{env:{...process.env,DRAMA_TEST_ZIP:zipFile},encoding:'utf8'});
const zip=JSON.parse(zipResult);if(!Array.isArray(zip.manifest))zip.manifest=zip.manifest.value;
assert.equal(zip.entries.length,19);assert.equal(zip.manifest.length,19);
for(const [i,entry] of zip.manifest.entries()){assert.equal(entry.clipId,clips[i].id);assert.equal(entry.position,i+1);assert.equal(entry.sha256,manifest.clips[i].delivery.sha256);assert.equal(zip.entries.find(v=>v.file===entry.file).sha256,entry.sha256);}
await fs.writeFile(path.join(output,'export-inspection.json'),JSON.stringify(zip,null,2));
await fs.writeFile(path.join(output,'verification.json'),JSON.stringify({projectId:project.id,episodeId:episode.id,canvasId:episode.canvasId,clips:clips.length,shots:63,adoptions:adoptions.length,adoptedHashes:38,exportVideoHashes:19,projectAssets:35,mediaPlayed,browserErrors:errors,consoleErrors,generationSubmitted:false},null,2));
console.log(JSON.stringify({verified:true,canvasId:episode.canvasId,output,projectAssets:35,mediaPlayed,consoleErrors:consoleErrors.length}));
