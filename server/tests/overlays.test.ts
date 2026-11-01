// P1-04: the preview's design layer arrives as a validated PNG per clip and is
// burned over the video; overlays are single-use and only server-named.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  TestServer,
  APP_HEADERS,
  startServer,
  makeTempDir,
  makeVideoFixture,
  samplePixel,
  uploadFile,
  postJson,
  waitForExport
} from './helpers';

let server: TestServer;
let fixturesDir: string;
let asset: string;

// Transparent PNG with an opaque green square at (100,100)-(300,300)
function makePng(fileName: string, { width = 1080, height = 1920, alpha = true } = {}): string {
  const filePath = path.join(fixturesDir, fileName);
  const format = alpha ? 'rgba' : 'rgb24';
  execFileSync('ffmpeg', [
    '-hide_banner', '-v', 'error', '-f', 'lavfi', '-i', `color=c=black@0.0:s=${width}x${height},format=rgba`,
    '-vf', `drawbox=x=100:y=100:w=200:h=200:color=0x00FF00@1:t=fill:replace=1,format=${format}`,
    '-frames:v', '1', '-y', filePath
  ], { windowsHide: true });
  return filePath;
}

async function uploadOverlay(filePath: string, headers: Record<string, string> = APP_HEADERS) {
  const form = new FormData();
  form.append('overlay', new Blob([fs.readFileSync(filePath)], { type: 'image/png' }), 'layer.png');
  const res = await fetch(`${server.baseUrl}/api/overlays`, { method: 'POST', headers, body: form });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const exportBody = (overlayId?: string) => ({
  projectId: 'proj_overlay',
  title: 'TOP 1',
  titlePosition: { fx: 0.5, fy: 0.22 },
  titleStroke: 2,
  background: '#FF0000',
  videoHeight: 40,
  clips: [{ id: 'c1', assetId: asset, startTime: 0, endTime: 1, rank: 1, title: 'CLIP', titleStyle: { color: '#FFFFFF' }, overlayId }]
});

const overlayFiles = () => fs.readdirSync(path.join(server.storageDir, 'overlays'));

before(async () => {
  fixturesDir = makeTempDir('overlay-fixtures');
  server = await startServer();
  const uploaded = await uploadFile(server.baseUrl, makeVideoFixture(path.join(fixturesDir, 'clip.mp4')));
  assert.equal(uploaded.status, 200);
  asset = String(uploaded.body.filename);
});

after(async () => {
  await server?.stop();
  fs.rmSync(fixturesDir, { recursive: true, force: true });
});

test('overlay uploads must be 1080x1920 RGBA PNGs sent by the app', async () => {
  const valid = await uploadOverlay(makePng('valid.png'));
  assert.equal(valid.status, 200, JSON.stringify(valid.body));
  assert.match(String(valid.body.overlayId), /^[0-9a-f-]{36}\.png$/);

  const textFile = path.join(fixturesDir, 'fake.png');
  fs.writeFileSync(textFile, 'not an image');
  for (const [name, file] of [
    ['not a png', textFile],
    ['wrong size', makePng('small.png', { width: 540, height: 960 })],
    ['no alpha', makePng('rgb.png', { alpha: false })]
  ] as const) {
    const res = await uploadOverlay(file);
    assert.equal(res.status, 400, name);
  }
  assert.equal((await uploadOverlay(makePng('noheader.png'), {})).status, 403);
  assert.equal(overlayFiles().length, 1, 'rejected overlays must not be stored');
});

test('export rejects overlay ids that were not issued by the server', async () => {
  for (const overlayId of ['../uploads/x.png', 'abc.png', '00000000-0000-0000-0000-000000000000.png', 'C:\\x.png']) {
    const res = await postJson(server.baseUrl, '/api/export', exportBody(overlayId));
    assert.equal(res.status, 400, overlayId);
  }
});

test('the overlay is drawn over the video and deleted after the export', async () => {
  const uploaded = await uploadOverlay(makePng('layer.png'));
  const overlayId = String(uploaded.body.overlayId);
  const created = await postJson(server.baseUrl, '/api/export', exportBody(overlayId));
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const job = await waitForExport(server.baseUrl, String(created.body.jobId));
  assert.equal(job.status, 'completed', `${job.error}\n${server.output()}`);

  const outFile = path.join(fixturesDir, 'export.mp4');
  fs.writeFileSync(outFile, Buffer.from(await (await fetch(`${server.baseUrl}${job.downloadUrl}`)).arrayBuffer()));
  const [r, g, b] = samplePixel(outFile, 0.5, 200, 200);
  assert.ok(g > 200 && r < 60 && b < 60, `overlay pixel ${r},${g},${b}`);
  const [br, bg, bb] = samplePixel(outFile, 0.5, 540, 100);
  assert.ok(br > 200 && bg < 50 && bb < 50, `background pixel ${br},${bg},${bb}`);
  assert.ok(!overlayFiles().includes(overlayId), 'overlay was not deleted');
});
