// Unit tests for the parts of the ffmpeg wrapper that do not run ffmpeg.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { parseProgressSeconds, resolveFontFile } from '../src/services/ffmpegService';

test('parseProgressSeconds reads the latest out_time_us of a -progress chunk', () => {
  const chunk = 'frame=10\nout_time_us=333333\nprogress=continue\nframe=20\nout_time_us=666666\nprogress=continue\n';
  assert.equal(parseProgressSeconds(chunk), 0.666666);
  assert.equal(parseProgressSeconds('frame=1\nout_time_us=N/A\n'), null);
  assert.equal(parseProgressSeconds(''), null);
});

test('titles use the bundled Inter unless FONT_FILE is set', () => {
  const previous = process.env.FONT_FILE;
  try {
    delete process.env.FONT_FILE;
    const fontsDir = path.join(__dirname, '..', 'assets', 'fonts');
    assert.equal(resolveFontFile(), path.join(fontsDir, 'Inter-Bold.ttf'));
    assert.equal(resolveFontFile('boldItalic'), path.join(fontsDir, 'Inter-BoldItalic.ttf'));
    assert.equal(resolveFontFile('medium'), path.join(fontsDir, 'Inter-Medium.ttf'));

    process.env.FONT_FILE = __filename;
    assert.equal(resolveFontFile('medium'), __filename);
  } finally {
    if (previous === undefined) delete process.env.FONT_FILE;
    else process.env.FONT_FILE = previous;
  }
});
