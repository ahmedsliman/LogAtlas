import { detectFormat, parseLog } from '../parsers/index';

const LARAVEL = '[2024-01-15 14:32:05] local.ERROR: Something failed';
const NGINX   = '192.168.1.1 - - [01/Jan/2024:12:00:00 +0000] "GET / HTTP/1.1" 200 1234 "-" "curl"';
const GARBAGE = 'this is just some random text with no pattern';

describe('detectFormat', () => {
  it('detects laravel', () => {
    expect(detectFormat([LARAVEL])).toBe('laravel');
  });

  it('detects nginx-access', () => {
    expect(detectFormat([NGINX])).toBe('nginx-access');
  });

  it('returns unknown for unrecognized lines', () => {
    expect(detectFormat([GARBAGE])).toBe('unknown');
  });

  it('picks the highest scoring format', () => {
    expect(detectFormat([LARAVEL, LARAVEL, NGINX])).toBe('laravel');
  });

  it('prefers nginx-access over apache-access on tie', () => {
    expect(detectFormat([NGINX, NGINX])).toBe('nginx-access');
  });
});

describe('parseLog', () => {
  it('parses laravel content', () => {
    const { format, entries } = parseLog(LARAVEL);
    expect(format).toBe('laravel');
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe('ERROR');
  });

  it('parses nginx content', () => {
    const { format, entries } = parseLog(NGINX);
    expect(format).toBe('nginx-access');
    expect(entries).toHaveLength(1);
  });

  it('respects explicit format override', () => {
    const { format } = parseLog(NGINX, 'apache-access');
    expect(format).toBe('apache-access');
  });
});
