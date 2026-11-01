// P1-03: every export is a 1080x1920, 30 fps, AAC 48 kHz stereo MP4, whatever the
// sources are (E-03, E-06), with the project background around the video.
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
  samplePixel,
  meanVolume,
  uploadFile,
  postJson,
  waitForExport
} from './helpers';

let server: TestServer;
let fixturesDir: string;
const assets: Record<string, string> = {};

before(async () => {
  fixturesDir = makeTempDir('export-fixtures');
  server = await startServer();
  const fixtures = {
    landscape: makeVideoFixture(path.join(fixturesDir, 'landscape.mp4'), { width: 640, height: 360, fps: 30, sampleRate: 48000 }),
    portrait: makeVideoFixture(path.join(fixturesDir, 'portrait.mp4'), { width: 720, height: 1280, fps: 25, sampleRate: 44100 }),
    mute: makeVideoFixture(path.join(fixturesDir, 'mute.mp4'), { width: 480, height: 480, fps: 30, audio: false })
  };
  for (const [name, file] of Object.entries(fixtures)) {
    const uploaded = await uploadFile(server.baseUrl, file);
    assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body));
    assets[name] = String(uploaded.body.filename);
  }
});

after(async () => {
  await server?.stop();
  fs.rmSync(fixturesDir, { recursive: true, force: true });
});

const clip = (assetId: string, rank: number, startTime: number, endTime: number) => ({
  id: `c${rank}`,
  assetId,
  startTime,
  endTime,
  rank,
  title: `CLIP ${rank}`,
  titleStyle: { color: '#FFFFFF' },
  clipTitlePosition: { x: 0, y: 120 }
});

const exportBody = (overrides: Record<string, unknown> = {}) => ({
  projectId: 'proj_export',
  title: 'TOP 3',
  titlePosition: { x: 0, y: -220 },
  titleStroke: 2,
  background: '#FF0000',
  videoHeight: 70,
  clips: [
    clip(assets.landscape, 1, 0.5, 1.5),
    clip(assets.portrait, 2, 0, 2),
    clip(assets.mute, 3, 0.3, 1)
  ],
  ...overrides
});

async function exportToFile(body: unknown, fileName: string, onStatus?: (job: Record<string, unknown>) => void): Promise<string> {
  const created = await postJson(server.baseUrl, '/api/export', body);
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const job = await waitForExport(server.baseUrl, String(created.body.jobId), undefined, onStatus);
  assert.equal(job.status, 'completed', `${job.error}\n${server.output()}`);
  const res = await fetch(`${server.baseUrl}${job.downloadUrl}`);
  assert.equal(res.status, 200);
  const outFile = path.join(fixturesDir, fileName);
  fs.writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
  return outFile;
}

const isRed = ([r, g, b]: number[]) => r > 200 && g < 50 && b < 50;

test('heterogeneous clips export as one normalized 1080x1920 video', async () => {
  const progress = new Set<number>();
  const outFile = await exportToFile(exportBody(), 'normalized.mp4', job => {
    if (job.status === 'processing') progress.add(Math.round(Number(job.progress)));
  });
  const info = probeVideo(outFile);

  // Progress moves inside each clip (E-18), not only once per step
  assert.ok(progress.size >= 4, `progress values: ${[...progress].join(', ')}`);

  assert.equal(info.width, 1080);
  assert.equal(info.height, 1920);
  assert.equal(info.fps, 30);
  assert.ok(Math.abs(info.duration - 3.7) < 0.1, `duration ${info.duration}`);
  assert.ok(info.hasAudio, 'no audio stream');
  assert.equal(info.audioSampleRate, 48000);
  assert.equal(info.audioChannels, 2);
  assert.ok(Math.abs(info.audioDuration - info.videoDuration) < 0.1, `audio ${info.audioDuration} vs video ${info.videoDuration}`);

  // Sources with audio keep it; the clip without audio gets silence, not a gap
  assert.ok(meanVolume(outFile, 0.1, 0.8) > -40, 'clip 1 lost its audio');
  assert.ok(meanVolume(outFile, 1.2, 1.6) > -40, 'clip 2 lost its audio');
  assert.equal(meanVolume(outFile, 3.1, 0.5), -Infinity);
});

test('the video fills the layout height and the background color shows around it', async () => {
  const outFile = await exportToFile(exportBody(), 'background.mp4');
  // Video area: 1080 x 1344 (70 %) centered, from y=288 to y=1632
  for (const seconds of [0.5, 2, 3.4]) {
    assert.ok(isRed(samplePixel(outFile, seconds, 540, 100)), `top band at ${seconds}s`);
    assert.ok(isRed(samplePixel(outFile, seconds, 540, 1800)), `bottom band at ${seconds}s`);
    assert.ok(!isRed(samplePixel(outFile, seconds, 20, 960)), `video area at ${seconds}s`);
  }
});

test('export rejects an invalid background color or layout height', async () => {
  for (const overrides of [{ background: 'red;drawtext' }, { background: 123 }, { videoHeight: 5 }, { videoHeight: '70' }]) {
    const res = await postJson(server.baseUrl, '/api/export', exportBody(overrides));
    assert.equal(res.status, 400, JSON.stringify(overrides));
  }
});
