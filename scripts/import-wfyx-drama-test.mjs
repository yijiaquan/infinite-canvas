import fs from 'node:fs/promises';
import { createReadStream, unlinkSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const source = path.resolve(process.env.DRAMA_IMPORT_SOURCE || 'D:/work/剪映/项目/万法有息');
const repo = path.resolve(import.meta.dirname, '..');
const output = path.resolve(process.env.DRAMA_IMPORT_REPORT_DIR || path.join(repo, 'data/import-wfyx'));
const relativeOutput = path.relative(source, output);
if (!relativeOutput.startsWith('..') && !path.isAbsolute(relativeOutput)) throw new Error('Reports must stay outside original source project');
const apply = process.argv.includes('--apply');
const wb = path.join(source, '.aidrama-workbench');
const records = new Map();
const digest = (value) => createHash('sha256').update(value).digest('hex');
const legacyReferencePattern = /@[^\n#]+#[A-Za-z0-9_-]+/g;
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function canvasReferenceKind(item) {
  if (item.object.mimeType?.startsWith('video/')) return 'video';
  if (item.object.mimeType?.startsWith('audio/')) return 'audio';
  return 'image';
}
function compileCanvasPrompt(prompt, sourceReferences, firstImageFallback = false) {
  const counts = { image: 0, video: 0, audio: 0 };
  const prefixes = { image: '图片', video: '视频', audio: '音频' };
  const ordered = ['image', 'video', 'audio'].flatMap(kind => sourceReferences.filter(reference => reference.kind === kind));
  let result = prompt;
  for (const reference of ordered) {
    const label = `${prefixes[reference.kind]}${++counts[reference.kind]}`;
    result = result.replace(new RegExp(`@${escapeRegExp(reference.title.trim())}#[A-Za-z0-9_-]+`, 'g'), label);
  }
  if (firstImageFallback && ordered[0]?.kind === 'image') {
    result = result.replace(/(^\s*subject_definitions\s*:\s*\r?\n)@[^\n#]+#[A-Za-z0-9_-]+/i, '$1图片1');
  }
  const unresolved = [...new Set(result.match(legacyReferencePattern) || [])];
  if (unresolved.length) throw new Error(`Unresolved legacy prompt references: ${unresolved.join(', ')}`);
  return result;
}
async function hashFile(file) {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(file)) h.update(chunk);
  return h.digest('hex');
}
function within(file) {
  const resolved = path.resolve(source, file);
  const relative = path.relative(source, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Source path escaped project');
  return resolved;
}
async function read(file) {
  const target = within(file);
  const raw = await fs.readFile(target);
  records.set(target, digest(raw));
  return raw.toString('utf8').replace(/^\uFEFF/, '');
}
async function json(file) { return JSON.parse(await read(file)); }
async function optional(file) { try { return await read(file); } catch (e) { if (e.code === 'ENOENT') return ''; throw e; } }
async function captureControl(dir) {
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    if (item.isSymbolicLink()) throw new Error('Symlink source unsupported');
    const file = path.join(dir, item.name);
    if (item.isDirectory() && item.name !== 'outputs') await captureControl(file);
    else if (item.isFile() && /\.(json|md)$/i.test(item.name)) await read(file);
  }
}
async function media(file) {
  const target = within(file);
  const stat = await fs.stat(target);
  const sha256 = await hashFile(target);
  records.set(target, sha256);
  return { path: path.relative(source, target), sha256, bytes: stat.size };
}
const project = await json(path.join(wb, 'project.json'));
const production = await json(path.join(wb, 'production.json'));
await captureControl(wb);
const index = await json('资产/资产索引.json');
const generated = await json(path.join(wb, 'assets/generated.json'));
const assetIndex = new Map(index.assets.filter(a => ['current', 'accepted'].includes(a.state)).map(a => [a.id, a]));
for (const a of generated.assets) if (['current', 'accepted'].includes(a.state)) assetIndex.set(a.id, a);
const allClips = [];
for (const item of await fs.readdir(path.join(wb, 'clips'), { withFileTypes: true })) {
  if (item.isDirectory()) allClips.push(await json(path.join(wb, 'clips', item.name, 'clip.json')));
}
const selected = allClips.filter(c => c.episode_id === 'EP01' && /^wfyx-ep01-/.test(c.id) && /^CLIP\d{2}$/.test(c.clip_number || '')).sort((a, b) => a.clip_number.localeCompare(b.clip_number));
if (selected.length !== 19 || new Set(selected.map(c => c.clip_number)).size !== 19) throw new Error('Expected 19 distinct formal Clips');
const candidates = [];
for (const item of await fs.readdir(path.join(wb, 'runs'), { withFileTypes: true })) {
  if (!item.isDirectory()) continue;
  const content = await optional(path.join(wb, 'runs', item.name, 'candidates.json'));
  if (content) candidates.push(...JSON.parse(content));
}
const required = new Set();
const clips = [];
for (const c of selected) {
  Object.values(c.bindings || {}).filter(Boolean).forEach(id => required.add(id));
  (c.storyboard?.reference_asset_ids || []).forEach(id => required.add(id));
  const finalMedia = await media(`媒体/视频/EP01/EP01_${c.clip_number}.mp4`);
  const adopted = candidates.filter(v => v.clip_id === c.id && v.artifact_type === 'video' && v.state === 'accepted' && v.sha256 === finalMedia.sha256);
  if (adopted.length !== 1) throw new Error(`${c.id}: expected one adopted candidate matching current delivery hash, got ${adopted.length}`);
  const candidate = adopted[0];
  const adoptedMedia = await media(candidate.path);
  if (candidate.sha256 && adoptedMedia.sha256 !== candidate.sha256) throw new Error(`${c.id}: accepted candidate hash mismatch`);
  const runPrompt = await optional(path.join(wb, 'runs', candidate.run_id, 'prompt.md'));
  clips.push({ sourceId: c.id, number: c.clip_number, title: c.title, status: c.status, duration: c.duration_seconds,
    shots: c.shots.map(s => ({ id: s.id, title: s.title || '', duration: s.duration_seconds, action: s.action || '', dialogue: s.dialogue || '', speaker: s.speaker || '', camera: s.camera || '', sound: s.sound || '', entryState: s.start_state || '', exitState: s.end_state || '' })),
    sourceShotFields: c.shots, bindings: c.bindings || {}, bindingRequirements: c.binding_requirements || [], storyboardReferences: c.storyboard?.reference_asset_ids || [], boardAssetId: c.storyboard?.current_asset_id || c.bindings?.picture_1,
    boardPrompt: await optional(path.join(wb, 'prompts', c.storyboard?.prompt_id || '_missing', 'draft.md')),
    videoPrompt: await optional(path.join(wb, 'prompts', c.primary_prompt_id || '_missing', 'draft.md')),
    adopted: { candidateId: candidate.id, runId: candidate.run_id, prompt: runPrompt, media: adoptedMedia },
    delivery: { ...finalMedia, matchesAdopted: finalMedia.sha256 === adoptedMedia.sha256 } });
}
const assets = [];
if ([...required].some(id => !assetIndex.has(id))) {
  const response = await fetch(`http://127.0.0.1:8188/aidrama-workbench/api/projects/${encodeURIComponent(project.id)}/assets`, { signal: AbortSignal.timeout(100000) });
  const result = await response.json();
  if (!response.ok || !result.ok || !Array.isArray(result.data)) throw new Error('Read-only source asset lookup failed');
  for (const a of result.data) if (!assetIndex.has(a.id)) assetIndex.set(a.id, { ...a, path: a.rel_path, type: a.role || a.kind });
}
for (const id of required) {
  const a = assetIndex.get(id);
  if (!a) throw new Error(`Missing current source asset ${id}`);
  const sourceKind = a.type || a.role || '';
  const kind = sourceKind === 'identity_board' || /^CHAR-/.test(id) ? 'character' : sourceKind === 'scene_board' || /^LOC-/.test(id) ? 'scene' : sourceKind === 'prop_reference' || /^PROP-/.test(id) ? 'prop' : /voice|audio/i.test(sourceKind) || a.kind === 'audio' ? 'voice' : 'reference';
  const sourceRunId = a.source_run_id || a.metadata?.source_run_id || '';
  assets.push({ sourceId: id, title: a.name || id, kind, description: a.notes || '', media: await media(a.path), sourceCandidateId: a.source_candidate_id || a.metadata?.source_candidate_id || '', sourceRunId,
    adoptedPrompt: sourceRunId ? await optional(path.join(wb, 'runs', sourceRunId, 'prompt.md')) : '' });
}
const sourceHashes = Object.fromEntries([...records].map(([file, hash]) => [path.relative(source, file), hash]).sort((a, b) => a[0].localeCompare(b[0])));
const speakerMappings = [];
for (const c of clips) {
  const definitions = c.videoPrompt.split(/\nsummary:/)[0];
  const speakers = new Map();
  const voiceSpeakers = {};
  for (const [slot, assetId] of Object.entries(c.bindings).filter(([slot]) => /^audio_/.test(slot))) {
    const asset = assets.find(a => a.sourceId === assetId);
    const name = asset?.title.match(/^(.+?)(?:原声音色参考|甜美精品自然音色)$/)?.[1];
    if (!name) throw new Error(`${c.number}: voice ${assetId} has no explicit named identity`);
    const declaration = definitions.split('\n').filter(line => /^<Subject \d+>/.test(line) && line.includes(`@${name}`));
    if (declaration.length !== 1) throw new Error(`${c.number}: ambiguous subject definition for voice ${name}`);
    const subject = declaration[0].match(/^<Subject (\d+)>/)[1];
    const voiceDeclaration = definitions.split('\n').find(line => line.startsWith(`@${asset.title}#`) && (line.includes(`<Subject ${subject}>`) || line.includes(name)));
    if (!voiceDeclaration) throw new Error(`${c.number}: no explicit voice declaration for ${name}`);
    speakers.set(subject, name); voiceSpeakers[slot] = name;
    speakerMappings.push({ clip: c.number, slot, assetId, speaker: name, subject: `<Subject ${subject}>`, evidence: [declaration[0], voiceDeclaration], source: 'currentVideoPrompt' });
  }
  const spoken = [...c.videoPrompt.matchAll(/<Subject (\d+)>\s*\(S\d+\)(?:(?!<Subject|<d>).)*<d>\[Chinese\]\s*([\s\S]*?)<\/d>/gs)];
  for (const shot of c.shots.filter(s => s.dialogue && !s.speaker)) {
    const matched = spoken.filter(m => m[2].trim() === shot.dialogue.trim());
    if (matched.length === 0 && Object.keys(voiceSpeakers).length === 0) {
      speakerMappings.push({ clip: c.number, shotId: shot.id, dialogue: shot.dialogue, speaker: '', source: 'currentVideoPrompt', note: 'No spoken dialogue tag or voice binding; source text retained without inventing a speaker.' });
      continue;
    }
    const names = new Set(matched.map(m => speakers.get(m[1])));
    if (matched.length === 0 || names.size !== 1 || names.has(undefined)) throw new Error(`${c.number}:${shot.id}: no unambiguous exact dialogue speaker match`);
    shot.speaker = [...names][0];
    speakerMappings.push({ clip: c.number, shotId: shot.id, dialogue: shot.dialogue, speaker: shot.speaker, evidence: matched[0][0], source: 'currentVideoPrompt' });
  }
  c.voiceSpeakers = voiceSpeakers;
}
const sourceDigest = digest(JSON.stringify(sourceHashes));
const manifest = { schemaVersion: 1, sourceKey: `${project.id}:EP01`, sourceDigest, sourceHashes,
  project: { title: `${project.name} EP01 导入验收副本`, sourceType: 'script', sourceText: production.script || '', globalStyle: production.global_style || '', adaptation: '旧工作台只读导入验收副本。当前草稿与历史采用提示词分别保留；不是重新生成。' },
  episode: { title: '第一集', script: production.script || '' }, clips, assets,
  excluded: allClips.filter(c => !selected.includes(c)).map(c => ({ id: c.id, title: c.title })) };
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'source-manifest.json'), JSON.stringify(manifest, null, 2));
await fs.writeFile(path.join(output, 'speaker-mapping-evidence.json'), JSON.stringify(speakerMappings, null, 2));
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', sourceDigest, clips: clips.length, shots: clips.reduce((n, c) => n + c.shots.length, 0), assets: assets.length, excluded: manifest.excluded, deliveryMismatches: clips.filter(c => !c.delivery.matchesAdopted).map(c => c.number), report: path.join(output, 'source-manifest.json') }, null, 2));

if (apply) {
  const target = process.env.DRAMA_IMPORT_TARGET;
  const token = process.env.DRAMA_IMPORT_TOKEN;
  if (!target || !token) throw new Error('--apply requires DRAMA_IMPORT_TARGET and DRAMA_IMPORT_TOKEN');
  const targetURL = new URL(target);
  if (!['http:', 'https:'].includes(targetURL.protocol) || targetURL.username || targetURL.password) throw new Error('Invalid target URL');
  const base = targetURL.origin;
  async function api(route, body) {
    const response = await fetch(base + (route === '/auth/me' ? '/api' : '/api/v1') + route, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body), signal: AbortSignal.timeout(120000) });
    const result = await response.json();
    if (!response.ok || result.code !== 0) throw new Error(`Target API failed ${route}: ${result.msg || result.message || response.status}`);
    return result.data;
  }
  const user = await api('/auth/me');
  const userID = user.id || user.user?.id;
  if (!userID) throw new Error('Unable to identify target owner');
  const journalFile = path.join(output, `journal-${digest(base + ':' + userID + ':' + manifest.sourceKey)}.json`);
  const lockFile = journalFile + '.lock';
  const lock = await fs.open(lockFile, 'wx');
  await lock.close();
  process.once('exit', () => { try { unlinkSync(lockFile); } catch {} });
  let journal;
  try { journal = JSON.parse(await fs.readFile(journalFile, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; journal = { sourceDigest, target: base, userID, steps: {} }; }
  if (journal.sourceDigest !== sourceDigest) throw new Error('Source changed since previous import; review instead of duplicating project');
  async function checkpoint(key, operation) {
    const existing = journal.steps[key];
    if (existing?.state === 'done') return existing.value;
    if (existing) throw new Error(`Unknown prior mutation ${key}; inspect target before retrying`);
    journal.steps[key] = { state: 'pending' };
    await fs.writeFile(journalFile, JSON.stringify(journal, null, 2));
    const value = await operation();
    journal.steps[key] = { state: 'done', value };
    await fs.writeFile(journalFile, JSON.stringify(journal, null, 2));
    return value;
  }
  async function upload(item) {
    return checkpoint(`media:${item.sha256}`, async () => {
      const raw = await fs.readFile(within(item.path));
      if (digest(raw) !== item.sha256) throw new Error('Media changed during import');
      const ext = path.extname(item.path).toLowerCase();
      const type = ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' })[ext];
      if (!type) throw new Error(`Unsupported media type ${ext}`);
      const form = new FormData(); form.append('file', new Blob([raw], { type }), path.basename(item.path));
      return api('/drama/media', form);
    });
  }
  const p = await checkpoint('project', () => api('/drama/projects', manifest.project));
  const e = await checkpoint('episode', () => api(`/drama/projects/${p.id}/episodes`, manifest.episode));
  const root = `/drama/projects/${p.id}/episodes/${e.id}`;
  const importedAssets = {};
  for (const a of assets) {
    const saved = await checkpoint(`asset:${a.sourceId}`, () => api(`/drama/projects/${p.id}/assets`, { title: a.title, kind: a.kind, description: `${a.description}\n来源资产：${a.sourceId}` }));
    const object = await upload(a.media);
    const version = await checkpoint(`version:${a.sourceId}`, () => api(`/drama/projects/${p.id}/assets/${saved.id}/versions`, { storageId: object.id, note: `来源 ${a.sourceId}; SHA256 ${a.media.sha256}`, expectedRevision: saved.revision }));
    await checkpoint(`asset-adoption:${a.sourceId}`, () => api(`/drama/projects/${p.id}/assets/${saved.id}`, { adoptedVersionId: version.version.id, expectedRevision: version.asset.revision }));
    importedAssets[a.sourceId] = { asset: saved, version: version.version, object };
  }
  const nodes = []; const connections = []; const clipIds = []; const adoptions=[];
  for (const [i, c] of clips.entries()) {
    const saved = await checkpoint(`clip:${c.sourceId}`, () => api(root + '/clips', { title: c.title, summary: `来源 ${c.sourceId} (${c.number})；源草稿状态 ${c.status}。历史采用媒体独立导入。`, shots: c.shots }));
    clipIds.push(saved.id);
    const prefix = `drama:${encodeURIComponent(saved.id)}`; const group = prefix + ':group'; const board = prefix + ':storyboard'; const video = prefix + ':video';
    const canvasPrompts = {};
    for (const stage of ['storyboard', 'video']) {
      const ordered = stage === 'storyboard' ? c.storyboardReferences.map(id => ['', id]) : Object.entries(c.bindings).sort(([a], [b]) => {
        const rank = slot => (/^picture_/.test(slot) ? 0 : /^video_/.test(slot) ? 100 : 200) + Number(slot.match(/\d+$/)?.[0] || 0);
        return rank(a) - rank(b);
      });
      const referenceSources = ordered.filter(([, id]) => id !== c.boardAssetId).map(([slot, id], order) => {
        const item = importedAssets[id];
        if (!item) throw new Error(`Unresolved binding ${c.sourceId}:${slot}:${id}`);
        const requirement = c.bindingRequirements.find(r => r.slot === slot);
        return { slot, id, item, binding: { assetId: item.asset.id, versionId: item.version.id, role: item.asset.kind === 'reference' && item.object.mimeType?.startsWith('video/') ? 'video_reference' : item.asset.kind, order, speaker: requirement?.speaker || c.voiceSpeakers[slot] || '' } };
      });
      const references = referenceSources.map(source => source.binding);
      const promptReferences = referenceSources.map(source => ({ title: source.item.asset.title, kind: canvasReferenceKind(source.item) }));
      if (stage === 'video') {
        const boardItem = importedAssets[c.boardAssetId];
        if (!boardItem) throw new Error(`Missing imported board ${c.boardAssetId}`);
        promptReferences.unshift({ title: boardItem.asset.title, kind: 'image' });
      }
      canvasPrompts[stage] = compileCanvasPrompt(stage === 'storyboard' ? c.boardPrompt : c.videoPrompt, promptReferences, stage === 'video');
      await checkpoint(`bindings:${c.sourceId}:${stage}`, () => api(`${root}/clips/${saved.id}/bindings/${stage}`, { expectedRevision: 0, references }));
      const targetNode=stage==='storyboard'?board:video;
      for(const reference of references){
        const item=Object.values(importedAssets).find(value=>value.version.id===reference.versionId);
        const speakerKey=reference.role==='voice'?(reference.speaker||''):'';
        const id=`drama:${encodeURIComponent(saved.id)}:reference:${encodeURIComponent(reference.versionId)}:${encodeURIComponent(speakerKey)}`;
        if(!nodes.some(node=>node.id===id))nodes.push({id,type:reference.role==='voice'?'audio':reference.role==='video_reference'?'video':'image',title:item.asset.title,position:{x:24,y:i*400},width:220,height:140,metadata:{groupId:group,dramaClipId:saved.id,dramaRole:'reference',dramaAssetVersionId:reference.versionId,content:`/api/files/${item.object.id}/content`,storageKey:`server:${item.object.id}`,status:'success'}});
        connections.push({id:`drama:binding:${encodeURIComponent(targetNode)}:${encodeURIComponent(reference.versionId)}:${encodeURIComponent(reference.role)}:${encodeURIComponent(reference.speaker||'')}`,fromNodeId:id,toNodeId:targetNode,dramaAssetVersionId:reference.versionId,dramaInputRole:reference.role,dramaInputOrder:reference.order,dramaInputSpeaker:reference.speaker});
      }
    }
    nodes.push({ id: group, type: 'group', title: c.title, position: { x: 0, y: i * 400 }, width: 740, height: 300, metadata: { dramaClipId: saved.id, dramaRole: 'group', dramaCollapsed: true } });
    const boardObject = importedAssets[c.boardAssetId]?.object;
    if (!boardObject) throw new Error(`Missing imported board ${c.boardAssetId}`);
    const videoObject = await upload(c.adopted.media);
    for (const [kind, id, object, prompt, x, role] of [['image', board, boardObject, canvasPrompts.storyboard, 24, 'storyboard'], ['video', video, videoObject, canvasPrompts.video, 396, 'video']]) {
      const content = `/api/files/${object.id}/content`;
      nodes.push({ id, type: kind, title: `${c.title} · ${role === 'video' ? '视频' : '导演故事板'}`, position: { x, y: i * 400 + 60 }, width: 320, height: 180, metadata: { dramaClipId: saved.id, dramaRole: role, groupId: group, generationMode: kind, excludeUpstreamText: true, status: 'success', content, prompt, storageKey: `server:${object.id}`, mimeType: object.mimeType } });
      const sourceKey = `${manifest.sourceKey}:${c.sourceId}:${role}:${kind === 'video' ? c.adopted.candidateId : c.boardAssetId}`;
      const run = await checkpoint(`run:${c.sourceId}:${kind}`, () => api(`${root}/clips/${saved.id}/import-output`, { requestId: `legacy:${digest(sourceKey + ':' + p.id)}`, sourceKey, nodeId: id, kind, storageId: object.id, prompt: kind === 'video' ? c.adopted.prompt : assets.find(a => a.sourceId === c.boardAssetId)?.adoptedPrompt || '', clipRevision: saved.revision }));
      adoptions.push({key:`adopt:${c.sourceId}:${kind}`,clipId:saved.id,input:{runId:run.id,storageId:object.id,expectedRevision:0,clipRevision:saved.revision}});
    }
    connections.push({ id: prefix + ':storyboard-video', fromNodeId: board, toNodeId: video });
  }
  await checkpoint('canvas', async () => {
    const canvas = (await api('/canvas/projects')).find(c => c.id === e.canvasId);
    if (!canvas || canvas.nodes.length) throw new Error('Target canvas is missing or already populated; inspect before overwrite');
    let top=0;
    for(const id of clipIds){
      const group=nodes.find(n=>n.metadata?.dramaClipId===id&&n.metadata.dramaRole==='group');
      const refs=nodes.filter(n=>n.metadata?.dramaClipId===id&&n.metadata.dramaRole==='reference');
      group.position={x:0,y:top};group.height=refs.length?330+Math.ceil(refs.length/3)*180:300;
      for(const node of nodes.filter(n=>n.metadata?.dramaClipId===id&&n!==group)){
        if(node.metadata.dramaRole==='reference'){
          const index=refs.indexOf(node);
          node.position={x:24+(index%3)*236,y:top+300+Math.floor(index/3)*180};
        }else node.position={x:node.metadata.dramaRole==='video'?396:24,y:top+60};
      }
      top+=group.height+160;
    }
    return api('/canvas/projects', { data: { ...canvas, nodes, connections, viewport:{x:100,y:100,k:1}, dramaPreparedClipIds: clipIds, updatedAt: new Date().toISOString() } });
  });
  for(const adoption of adoptions)await checkpoint(adoption.key,()=>api(`${root}/clips/${adoption.clipId}/adoption`,adoption.input));
  console.log(JSON.stringify({ projectId: p.id, episodeId: e.id, canvasId: e.canvasId, journal: journalFile }));
}
for (const [file, before] of records) if (await hashFile(file) !== before) throw new Error(`Source invariance failed: ${path.relative(source, file)}`);
console.log('Source hash invariance verified. No generation submitted.');
