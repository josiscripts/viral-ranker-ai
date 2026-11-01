// Regression tests for the P0 security fixes, against a real server process.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  TestServer,
  startServer,
  makeTempDir,
  makeVideoFixture,
  probeVideo,
  uploadFile,
  postJson,
  waitForExport
} from './helpers';

let server: TestServer;
let fixturesDir: string;
let assetA: string;
let assetB: string;

const clip = (assetId: string, rank: number, title: string) => ({
  id: `c${rank}`,
  assetId,
  startTime: 0.2,
  endTime: 1.2,
  rank,
  title,
  titleStyle: { color: '#FFFFFF' },
  clipTitlePosition: { x: 0, y: 120 }
});

const exportBody = () => ({
  projectId: 'proj_test',
  title: 'TOP 2 "Bro\'s" 100% : a,b;[x]\nLINE $(echo X) `id` %{pts}',
  titlePosition: { x: 0, y: -220 },
  titleStroke: 2,
  clips: [clip(assetA, 1, "Bro's internet: 50% \\ 'q'"), clip(assetB, 2, 'C:\\temp; [in] , "quoted" $(whoami)')]
});

before(async () => {
  fixturesDir = makeTempDir('fixtures');
  server = await startServer();
  const a = await uploadFile(server.baseUrl, makeVideoFixture(path.join(fixturesDir, 'a.mp4')));
  const b = await uploadFile(server.baseUrl, makeVideoFixture(path.join(fixturesDir, 'b.mp4')));
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assetA = String(a.body.filename);
  assetB = String(b.body.filename);
});

after(async () => {
  await server?.stop();
  fs.rmSync(fixturesDir, { recursive: true, force: true });
});

test('health responds', async () => {
  const res = await fetch(`${server.baseUrl}/api/health`);
  assert.equal(res.status, 200);
});

test('POST without the application header is rejected', async () => {
  const res = await fetch(`${server.baseUrl}/api/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.equal(res.status, 403);
});

test('upload rejects files that are not videos and leaves no temp files', async () => {
  const fake = path.join(fixturesDir, 'not_video.mp4');
  fs.writeFileSync(fake, 'this is not a video');
  const res = await uploadFile(server.baseUrl, fake);
  assert.equal(res.status, 400);
  assert.deepEqual(fs.readdirSync(path.join(server.storageDir, 'tmp')), []);
});

test('upload sanitizes hostile file names', async () => {
  const res = await uploadFile(server.baseUrl, path.join(fixturesDir, 'a.mp4'), 'clip "$(echo X)" & echo INJECTED; it\'s `ls`.mp4');
  assert.equal(res.status, 200);
  assert.match(String(res.body.filename), /^\d+_[A-Za-z0-9_-]+\.mp4$/);
});

test('download rejects unsupported protocols and look-alike hosts without calling yt-dlp', async () => {
  for (const url of ['ftp://youtube.com/watch?v=x', 'https://youtube.com.evil.example/watch?v=x', 'https://evil.example/?u=youtube.com']) {
    const res = await postJson(server.baseUrl, '/api/download', { url });
    assert.equal(res.status, 400, url);
  }
});

test('export payloads that escape uploads/ or inject filter syntax are rejected', async () => {
  const cases: Record<string, (body: ReturnType<typeof exportBody>) => void> = {
    'url instead of assetId': body => { body.clips[0] = { ...body.clips[0], assetId: undefined as unknown as string, url: 'http://169.254.169.254/latest' } as typeof body.clips[0]; },
    'assetId traversal': body => { body.clips[0].assetId = '../../server/.env'; },
    'assetId absolute path': body => { body.clips[0].assetId = 'C:\\Windows\\win.ini'; },
    'titleStroke injection': body => { (body as Record<string, unknown>).titleStroke = '2:textfile=/etc/passwd'; },
    'control character in title': body => { body.title = 'bad\u0007title'; },
    'title too long': body => { body.title = 'x'.repeat(101); },
    'negative startTime': body => { body.clips[0].startTime = -1; },
    'startTime after endTime': body => { body.clips[0].startTime = 5; body.clips[0].endTime = 1; }
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const body = exportBody();
    mutate(body);
    const res = await postJson(server.baseUrl, '/api/export', body);
    assert.equal(res.status, 400, name);
  }
});

test('export file route rejects invalid and unknown job ids; legacy route is gone', async () => {
  assert.equal((await fetch(`${server.baseUrl}/api/export/..%2F..%2Fpackage.json/file`)).status, 400);
  assert.equal((await fetch(`${server.baseUrl}/api/export/00000000-0000-4000-8000-000000000000/file`)).status, 404);
  assert.equal((await fetch(`${server.baseUrl}/api/exports/anything.mp4`)).status, 404);
});

test('export with hostile titles completes and is downloadable', async () => {
  const created = await postJson(server.baseUrl, '/api/export', exportBody());
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const job = await waitForExport(server.baseUrl, String(created.body.jobId));
  assert.equal(job.status, 'completed', `${job.error}\n${server.output()}`);

  const res = await fetch(`${server.baseUrl}${job.downloadUrl}`);
  assert.equal(res.status, 200);
  const outFile = path.join(fixturesDir, 'export.mp4');
  fs.writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
  const info = probeVideo(outFile);
  assert.ok(Math.abs(info.duration - 2) < 0.2, `duration ${info.duration}`);
});
