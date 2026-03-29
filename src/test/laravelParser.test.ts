import { parseLaravel, detectScore } from '../parsers/laravelParser';

const SINGLE = '[2024-01-15 14:32:05] local.ERROR: Uncaught exception in app';
const NGINX_LINE = '192.168.1.1 - - [01/Jan/2024:12:00:00 +0000] "GET / HTTP/1.1" 200 1234 "-" "curl"';

describe('parseLaravel', () => {
  it('parses timestamp', () => {
    const [e] = parseLaravel(SINGLE);
    expect(e.timestamp).toBe('2024-01-15 14:32:05');
  });

  it('parses level ERROR', () => {
    const [e] = parseLaravel(SINGLE);
    expect(e.level).toBe('ERROR');
  });

  it('parses message', () => {
    const [e] = parseLaravel(SINGLE);
    expect(e.message).toBe('Uncaught exception in app');
  });

  it('maps emergency → CRITICAL', () => {
    const [e] = parseLaravel('[2024-01-15 14:32:05] local.EMERGENCY: Disk full');
    expect(e.level).toBe('CRITICAL');
  });

  it('maps alert → CRITICAL', () => {
    const [e] = parseLaravel('[2024-01-15 14:32:05] local.ALERT: Alert');
    expect(e.level).toBe('CRITICAL');
  });

  it('maps critical → CRITICAL', () => {
    const [e] = parseLaravel('[2024-01-15 14:32:05] local.CRITICAL: Critical');
    expect(e.level).toBe('CRITICAL');
  });

  it('maps warning → WARNING', () => {
    const [e] = parseLaravel('[2024-01-15 14:32:05] local.WARNING: Deprecated');
    expect(e.level).toBe('WARNING');
  });

  it('maps notice → NOTICE', () => {
    const [e] = parseLaravel('[2024-01-15 14:32:05] local.NOTICE: Note');
    expect(e.level).toBe('NOTICE');
  });

  it('maps info → INFO', () => {
    const [e] = parseLaravel('[2024-01-15 14:32:05] local.INFO: Started');
    expect(e.level).toBe('INFO');
  });

  it('maps debug → DEBUG', () => {
    const [e] = parseLaravel('[2024-01-15 14:32:05] local.DEBUG: Value');
    expect(e.level).toBe('DEBUG');
  });

  it('groups stack trace lines into context', () => {
    const content = [
      '[2024-01-15 14:32:05] local.ERROR: Something failed',
      '#0 /var/www/app.php(10): doSomething()',
      '#1 {main}',
    ].join('\n');
    const [e] = parseLaravel(content);
    expect(e.context).toContain('#0 /var/www/app.php');
    expect(e.context).toContain('#1 {main}');
  });

  it('parses multiple entries', () => {
    const content = [
      '[2024-01-15 14:32:05] local.ERROR: First',
      '[2024-01-15 14:32:06] local.INFO: Second',
    ].join('\n');
    const entries = parseLaravel(content);
    expect(entries).toHaveLength(2);
    expect(entries[0].message).toBe('First');
    expect(entries[1].message).toBe('Second');
  });

  it('assigns correct lineNumber', () => {
    const [e] = parseLaravel(SINGLE);
    expect(e.lineNumber).toBe(1);
  });

  it('sets format to laravel', () => {
    const [e] = parseLaravel(SINGLE);
    expect(e.format).toBe('laravel');
  });

  it('parses a log with Windows CRLF line endings', () => {
    const content =
      '[2024-01-15 14:32:05] local.ERROR: First\r\n' +
      '[2024-01-15 14:32:06] local.INFO: Second\r\n';
    const entries = parseLaravel(content);
    expect(entries).toHaveLength(2);
    expect(entries[0].level).toBe('ERROR');
    expect(entries[1].level).toBe('INFO');
  });

  it('parses a log with bare CR line endings', () => {
    const content =
      '[2024-01-15 14:32:05] local.WARNING: One\r' +
      '[2024-01-15 14:32:06] local.DEBUG: Two\r';
    const entries = parseLaravel(content);
    expect(entries).toHaveLength(2);
    expect(entries[0].level).toBe('WARNING');
    expect(entries[1].level).toBe('DEBUG');
  });
});

describe('laravelParser.detectScore', () => {
  it('scores 1 for a laravel line', () => {
    expect(detectScore([SINGLE])).toBe(1);
  });

  it('scores 0 for a nginx line', () => {
    expect(detectScore([NGINX_LINE])).toBe(0);
  });
});
