// Unit tests for the download helpers that do not need network access.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSupportedUrl, getYtDlpErrorMessage } from '../src/services/downloadService';

test('supported hosts are matched exactly or as subdomains', () => {
  assert.equal(parseSupportedUrl('https://www.youtube.com/watch?v=abc').platform, 'youtube');
  assert.equal(parseSupportedUrl('https://youtu.be/abc').platform, 'youtube');
  assert.equal(parseSupportedUrl('https://m.tiktok.com/@user/video/1').platform, 'tiktok');
  assert.equal(parseSupportedUrl('https://www.instagram.com/reel/abc/').platform, 'instagram');
});

test('look-alike hosts, other protocols and garbage are rejected', () => {
  for (const url of [
    'https://youtube.com.evil.example/watch?v=abc',
    'https://evil.example/?next=youtube.com',
    'https://notyoutube.com/watch?v=abc',
    'ftp://youtube.com/watch?v=abc',
    'file:///C:/Windows/win.ini',
    '--exec calc',
    ''
  ]) {
    assert.equal(parseSupportedUrl(url).platform, 'unknown', url);
  }
});

test('yt-dlp errors are reported without the warnings printed before them', () => {
  const output = [
    'WARNING: [youtube] [jsc] Remote components challenge solver script (deno) were skipped.',
    'WARNING: [youtube] abc: n challenge solving failed: Some formats may be missing.',
    'ERROR: [youtube] abc: Video unavailable'
  ].join('\r\n');
  assert.equal(getYtDlpErrorMessage(output), '[youtube] abc: Video unavailable');
});

test('output without ERROR lines is returned trimmed and capped', () => {
  assert.equal(getYtDlpErrorMessage('  something odd  '), 'something odd');
  assert.equal(getYtDlpErrorMessage('x'.repeat(500)).length, 200);
});
