import { parseNginxAccess, detectScore } from '../parsers/nginxParser';

const OK_LINE    = '192.168.1.1 - - [01/Jan/2024:12:00:00 +0000] "GET /index.html HTTP/1.1" 200 1234 "-" "Mozilla/5.0"';
const NOT_FOUND  = '10.0.0.1 - - [01/Jan/2024:12:00:01 +0000] "GET /missing HTTP/1.1" 404 0 "-" "curl"';
const SERVER_ERR = '10.0.0.2 - - [01/Jan/2024:12:00:02 +0000] "POST /api HTTP/1.1" 500 0 "-" "app"';
const REDIRECT   = '10.0.0.3 - - [01/Jan/2024:12:00:03 +0000] "GET /old HTTP/1.1" 301 0 "-" "browser"';
const LARAVEL    = '[2024-01-15 14:32:05] local.ERROR: Something';

describe('parseNginxAccess', () => {
  it('parses IP', () => {
    const [e] = parseNginxAccess(OK_LINE);
    expect(e.ip).toBe('192.168.1.1');
  });

  it('parses method', () => {
    const [e] = parseNginxAccess(OK_LINE);
    expect(e.method).toBe('GET');
  });

  it('parses url', () => {
    const [e] = parseNginxAccess(OK_LINE);
    expect(e.url).toBe('/index.html');
  });

  it('parses statusCode', () => {
    const [e] = parseNginxAccess(OK_LINE);
    expect(e.statusCode).toBe(200);
  });

  it('assigns INFO for 2xx', () => {
    const [e] = parseNginxAccess(OK_LINE);
    expect(e.level).toBe('INFO');
  });

  it('assigns WARNING for 4xx', () => {
    const [e] = parseNginxAccess(NOT_FOUND);
    expect(e.level).toBe('WARNING');
  });

  it('assigns ERROR for 5xx', () => {
    const [e] = parseNginxAccess(SERVER_ERR);
    expect(e.level).toBe('ERROR');
  });

  it('assigns NOTICE for 3xx', () => {
    const [e] = parseNginxAccess(REDIRECT);
    expect(e.level).toBe('NOTICE');
  });

  it('sets format to nginx-access', () => {
    const [e] = parseNginxAccess(OK_LINE);
    expect(e.format).toBe('nginx-access');
  });

  it('skips blank lines', () => {
    const entries = parseNginxAccess(OK_LINE + '\n\n' + NOT_FOUND);
    expect(entries).toHaveLength(2);
  });

  it('assigns correct lineNumber', () => {
    const [e] = parseNginxAccess(OK_LINE);
    expect(e.lineNumber).toBe(1);
  });

  it('parses a log with Windows CRLF line endings', () => {
    const line1 = '192.168.1.1 - - [01/Jan/2024:12:00:00 +0000] "GET / HTTP/1.1" 200 1234 "-" "curl"';
    const line2 = '10.0.0.1 - - [01/Jan/2024:12:00:01 +0000] "GET /404 HTTP/1.1" 404 0 "-" "curl"';
    const entries = parseNginxAccess(line1 + '\r\n' + line2 + '\r\n');
    expect(entries).toHaveLength(2);
    expect(entries[0].level).toBe('INFO');
    expect(entries[1].level).toBe('WARNING');
  });

  it('parses a line where body bytes field is a hyphen', () => {
    const line = '192.168.1.1 - - [01/Jan/2024:12:00:00 +0000] "GET / HTTP/1.1" 404 - "-" "curl"';
    const entries = parseNginxAccess(line);
    expect(entries).toHaveLength(1);
    expect(entries[0].statusCode).toBe(404);
    expect(entries[0].level).toBe('WARNING');
  });
});

describe('nginxParser.detectScore', () => {
  it('scores 1 for combined log format', () => {
    expect(detectScore([OK_LINE])).toBe(1);
  });

  it('scores 0 for a laravel line', () => {
    expect(detectScore([LARAVEL])).toBe(0);
  });
});
