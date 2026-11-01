// Unit tests for the parts of the ffmpeg wrapper that do not run ffmpeg.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProgressSeconds } from '../src/services/ffmpegService';

test('parseProgressSeconds reads the latest out_time_us of a -progress chunk', () => {
  const chunk = 'frame=10\nout_time_us=333333\nprogress=continue\nframe=20\nout_time_us=666666\nprogress=continue\n';
  assert.equal(parseProgressSeconds(chunk), 0.666666);
  assert.equal(parseProgressSeconds('frame=1\nout_time_us=N/A\n'), null);
  assert.equal(parseProgressSeconds(''), null);
});
