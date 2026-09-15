import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createReadStream, openSync, closeSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes, createHash } from 'node:crypto';

const repo = path.resolve(import.meta.dirname, '..');
const parent = path.join(repo, 'data/isolated-tests');
await fs.mkdir(parent, { recursive: true });
const directory = await fs.mkdtemp(path.join(parent, 'drama-import-'));
const reportDir = path.join(directory, 'import');
let backend;
let token = '';
const hash = data => createHash('sha256').update(data).digest('hex');
async function hashFile(file) { const h = createHash('sha256'); for await (const c of createReadStream(file)) h.update(c); return h.digest('hex'); }
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function run(command, args, env = {}, cwd = repo) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', c => { output += c; }); child.stderr.on('data', c => { output += c; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve(output) : reject(new Error(`${path.basename(command)} exited ${code}: ${output}`)));
  });
}
const port = await new Promise((resolve, reject) => {
  const listener = createServer(); listener.on('error', reject);
  listener.listen(0, '127.0.0.1', () => { const n = listener.address().port; listener.close(() => resolve(n)); });
});
const base = `http://127.0.0.1:${port}`;
async function api(route, body) {
  const response = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(120000) });
  const result = await response.json();
  assert.equal(result.code, 0, `${route}: ${result.msg || result.message}`);
  return result.data;
}
try {
  const exe = path.join(directory, process.platform === 'win32' ? 'backend.exe' : 'backend');
  await run(process.env.DRAMA_GO_EXE || 'go', ['build', '-o', exe, '.']);
  const password = randomBytes(24).toString('hex');
  const log = openSync(path.join(directory, 'backend.log'), 'a');
  backend = spawn(exe, [], { cwd: directory, env: { ...process.env, PORT: String(port), STORAGE_DRIVER: 'sqlite', DATABASE_DSN: path.join(directory, 'isolated.db'), ADMIN_USERNAME: 'import-test', ADMIN_PASSWORD: password, JWT_SECRET: randomBytes(32).toString('hex'), AI_LOG_DIR: path.join(directory, 'ai-logs') }, windowsHide: true, stdio: ['ignore', log, log] });
  closeSync(log);
  for (let i = 0; i < 120; i++) {
    if (backend.exitCode !== null) throw new Error('Isolated backend exited');
    try { if ((await fetch(base + '/api/auth/me')).status < 500) break; } catch {}
    await delay(500);
  }
  token = (await api('/api/auth/login', { username: 'import-test', password })).token;
  const importerEnv = { DRAMA_IMPORT_TARGET: base, DRAMA_IMPORT_TOKEN: token, DRAMA_IMPORT_REPORT_DIR: reportDir };
  await fs.writeFile(path.join(directory, 'import-first.log'), await run(process.execPath, [path.join(repo, 'scripts/import-wfyx-drama-test.mjs'), '--apply'], importerEnv));
  const manifest = JSON.parse(await fs.readFile(path.join(reportDir, 'source-manifest.json')));
  assert.equal(manifest.clips.length, 19); assert.equal(manifest.clips.reduce((n, c) => n + c.shots.length, 0), 63); assert.equal(manifest.assets.length, 35);
  const journalFile = (await fs.readdir(reportDir)).find(f => /^journal-.*\.json$/.test(f));
  const journal = JSON.parse(await fs.readFile(path.join(reportDir, journalFile)));
  const project = journal.steps.project.value, episode = journal.steps.episode.value;
  const root = `/api/v1/drama/projects/${project.id}/episodes/${episode.id}`;
  const clips = await api(root + '/clips'); assert.equal(clips.length, 19);
  const runs = await api(root + '/runs'); assert.equal(runs.length, 38);
  assert.ok(runs.every(r => r.status === 'completed' && r.snapshot.model === 'legacy-import' && r.credits === 0));
  const assets = await api(`/api/v1/drama/projects/${project.id}/assets`);
  assert.equal(assets.assets.length, 35); assert.equal(assets.versions.length, 35);
  assert.equal(assets.assets.filter(a => a.kind === 'character').length, 2);
  for (const sourceAsset of manifest.assets) {
    const assetId = journal.steps[`asset:${sourceAsset.sourceId}`].value.id;
    const asset = assets.assets.find(a => a.id === assetId);
    const version = assets.versions.find(v => v.id === asset.adoptedVersionId);
    assert.equal(version.assetId, assetId);
    const response = await fetch(base + `/api/files/${version.storageId}/content`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200); assert.equal(hash(Buffer.from(await response.arrayBuffer())), sourceAsset.media.sha256);
  }
  const canvas = (await api('/api/v1/canvas/projects')).find(c => c.id === episode.canvasId);
  assert.equal(canvas.nodes.filter(n => n.metadata?.dramaRole === 'group').length, 19);
  assert.equal(canvas.nodes.filter(n => n.metadata?.dramaRole === 'storyboard').length, 19);
  assert.equal(canvas.nodes.filter(n => n.metadata?.dramaRole === 'video').length, 19);
  assert.equal(new Set(canvas.nodes.map(n => n.id)).size, canvas.nodes.length);
  for (const [i, source] of manifest.clips.entries()) {
    const clip = clips[i]; assert.equal(clip.id, journal.steps[`clip:${source.sourceId}`].value.id); assert.deepEqual(clip.shots, source.shots);
    const adoptions = await api(`${root}/clips/${clip.id}/adoption`); assert.equal(adoptions.length, 2); assert.ok(adoptions.every(a => !a.needsReview));
    for (const kind of ['image', 'video']) {
      const pick = adoptions.find(a => a.kind === kind); const run = runs.find(r => r.id === pick.runId);
      assert.equal(run.clipId, clip.id); assert.equal(run.outputs[0].storageId, pick.storageId);
      const expected = kind === 'video' ? source.adopted.media : manifest.assets.find(a => a.sourceId === source.boardAssetId).media;
      const response = await fetch(base + `/api/files/${pick.storageId}/content`, { headers: { Authorization: `Bearer ${token}` } }); assert.equal(response.status, 200);
      assert.equal(hash(Buffer.from(await response.arrayBuffer())), expected.sha256);
      const node = canvas.nodes.find(n => n.metadata?.dramaClipId === clip.id && n.metadata?.dramaRole === (kind === 'image' ? 'storyboard' : 'video'));
      assert.doesNotMatch(node.metadata.prompt, /@[^\n#]+#[A-Za-z0-9_-]+/);
      assert.match(node.metadata.prompt, /(?:图片|视频|音频)\d+/);
      assert.equal(run.snapshot.prompt, kind === 'video' ? source.adopted.prompt : manifest.assets.find(a => a.sourceId === source.boardAssetId).adoptedPrompt);
    }
  }
  const exported = await fetch(base + root + '/export', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(120000) });
  assert.equal(exported.status, 200); const zipFile = path.join(directory, 'episode.zip'); await fs.writeFile(zipFile, Buffer.from(await exported.arrayBuffer()));
  // Use the platform ZIP parser to inspect entries without extracting or executing files.
  const zipResult = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [IO.Compression.ZipFile]::OpenRead($env:DRAMA_TEST_ZIP); try { $items = @(); foreach ($entry in $zip.Entries) { $stream = $entry.Open(); try { if ($entry.FullName -eq "manifest.json") { $reader = New-Object IO.StreamReader($stream); $manifest = $reader.ReadToEnd() | ConvertFrom-Json } else { $sha = [Security.Cryptography.SHA256]::Create(); $digest = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace("-", "").ToLowerInvariant(); $items += @{file=$entry.FullName;sha256=$digest} } } finally { $stream.Dispose() } }; @{manifest=$manifest;entries=$items} | ConvertTo-Json -Depth 10 -Compress } finally { $zip.Dispose() }'], { DRAMA_TEST_ZIP: zipFile });
  await fs.writeFile(path.join(directory, 'zip-inspection.json'), zipResult);
  const zip = JSON.parse(zipResult);
  // Windows PowerShell 5 serializes pipeline arrays with value/Count metadata.
  if (!Array.isArray(zip.manifest)) zip.manifest = zip.manifest.value;
  assert.equal(zip.entries.length, 19); assert.equal(zip.manifest.length, 19);
  for (const [i, entry] of zip.manifest.entries()) { assert.equal(entry.clipId, clips[i].id); assert.equal(entry.position, i + 1); assert.equal(path.extname(entry.file), '.mp4'); assert.equal(entry.sha256, manifest.clips[i].delivery.sha256); assert.equal(zip.entries.find(v => v.file === entry.file).sha256, entry.sha256); }
  const before = JSON.stringify({ canvas, clips, runs, assets });
  await fs.writeFile(path.join(directory, 'import-repeat.log'), await run(process.execPath, [path.join(repo, 'scripts/import-wfyx-drama-test.mjs'), '--apply'], importerEnv));
  assert.equal(JSON.stringify({ canvas: (await api('/api/v1/canvas/projects')).find(c => c.id === episode.canvasId), clips: await api(root + '/clips'), runs: await api(root + '/runs'), assets: await api(`/api/v1/drama/projects/${project.id}/assets`) }), before);
  assert.equal((await api('/api/v1/drama/projects')).length, 1);
  const second = await api(`/api/v1/drama/projects/${project.id}/episodes`, { title: 'Shared asset acceptance' });
  const secondRoot = `/api/v1/drama/projects/${project.id}/episodes/${second.id}`;
  const secondClip = await api(secondRoot + '/clips', { title: 'Shared reference', shots: [] });
  const shared = assets.assets.find(a => a.kind === 'character');
  const refs = [{ assetId: shared.id, versionId: shared.adoptedVersionId, role: 'character', order: 0, speaker: '' }];
  const binding = await api(`${secondRoot}/clips/${secondClip.id}/bindings/storyboard`, { expectedRevision: 0, references: refs }); assert.deepEqual(binding.references, refs);
  const secondCanvas = (await api('/api/v1/canvas/projects')).find(c => c.id === second.canvasId);
  const sharedVersion = assets.versions.find(v => v.id === shared.adoptedVersionId);
  const boardId = `drama:${secondClip.id}:storyboard`, refId = boardId + ':shared-reference';
  secondCanvas.nodes = [{ id: boardId, type: 'image', title: 'Storyboard', position: { x: 300, y: 0 }, width: 240, height: 180, metadata: { dramaClipId: secondClip.id, dramaRole: 'storyboard' } }, { id: refId, type: 'image', title: shared.title, position: { x: 0, y: 0 }, width: 240, height: 180, metadata: { dramaClipId: secondClip.id, dramaRole: 'reference', dramaBindingTarget: boardId, dramaAssetVersionId: sharedVersion.id, dramaInputRole: 'character', dramaInputOrder: 0, storageKey: `server:${sharedVersion.storageId}` } }];
  secondCanvas.connections = [{ id: refId + ':link', fromNodeId: refId, toNodeId: boardId }];
  await api('/api/v1/canvas/projects', { data: secondCanvas });
  assert.equal((await api('/api/v1/canvas/projects')).find(c => c.id === second.canvasId).nodes.find(n => n.id === refId).metadata.dramaAssetVersionId, shared.adoptedVersionId);
  assert.deepEqual((await api(`/api/v1/drama/projects/${project.id}/assets`)), assets);
  assert.deepEqual((await api('/api/v1/canvas/projects')).find(c => c.id === episode.canvasId), canvas);
  const source = process.env.DRAMA_IMPORT_SOURCE || 'D:/work/剪映/项目/万法有息';
  for (const [file, expected] of Object.entries(manifest.sourceHashes)) assert.equal(await hashFile(path.join(source, file)), expected, file);
  const report = { passed: true, clips: 19, shots: 63, assets: 35, assetHashesVerified: 35, importedHistories: 38, adoptedHashesVerified: 38, exportVideoHashesVerified: 19, sourceFilesUnchanged: Object.keys(manifest.sourceHashes).length, repeatIdempotent: true, crossEpisodeSharedAsset: true, originalCanvasUnchanged: true, generationSubmitted: false, projectId: project.id, episodeId: episode.id };
  await fs.writeFile(path.join(directory, 'acceptance.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ ...report, directory }, null, 2));
} catch (error) {
  await fs.writeFile(path.join(directory, 'failure.txt'), error.stack || String(error)); throw error;
} finally {
  if (backend && backend.exitCode === null) { backend.kill(); await new Promise(resolve => backend.once('exit', resolve)); }
  console.log(`Isolated import evidence: ${directory}`);
}
