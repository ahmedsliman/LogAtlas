import { parseApacheAccess, detectScore } from '../parsers/apacheParser';

const LINE = '192.168.1.1 - - [01/Jan/2024:12:00:00 +0000] "GET /index.html HTTP/1.1" 200 1234 "-" "Mozilla/5.0"';

describe('parseApacheAccess', () => {
  it('sets format to apache-access', () => {
    const [e] = parseApacheAccess(LINE);
    expect(e.format).toBe('apache-access');
  });

  it('parses ip', () => {
    const [e] = parseApacheAccess(LINE);
    expect(e.ip).toBe('192.168.1.1');
  });

  it('parses statusCode', () => {
    const [e] = parseApacheAccess(LINE);
    expect(e.statusCode).toBe(200);
  });

  it('assigns INFO for 200', () => {
    const [e] = parseApacheAccess(LINE);
    expect(e.level).toBe('INFO');
  });
});

describe('apacheParser.detectScore', () => {
  it('scores 1 for combined log format', () => {
    expect(detectScore([LINE])).toBe(1);
  });
});
