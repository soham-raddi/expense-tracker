import { parseDdMonYy, pickTimestamp, rupeesToPaise } from '../parseUtils';
import { senderCode } from '../registry';

describe('rupeesToPaise', () => {
  test.each([
    ['120.00', 12000],
    ['1,250.50', 125050],
    ['10', 1000],
    ['0.5', 50],
    ['1,00,000.99', 10000099],
  ])('%s -> %d', (input, paise) => {
    expect(rupeesToPaise(input)).toBe(paise);
  });

  test('rejects garbage', () => {
    expect(() => rupeesToPaise('12.3.4')).toThrow();
  });
});

describe('parseDdMonYy', () => {
  test('is midnight IST', () => {
    expect(parseDdMonYy('28-Oct-26')).toBe(Date.parse('2026-10-28T00:00:00+05:30'));
    expect(parseDdMonYy('1-jan-2027')).toBe(Date.parse('2027-01-01T00:00:00+05:30'));
  });

  test('returns null for bad input', () => {
    expect(parseDdMonYy('28-Foo-26')).toBeNull();
    expect(parseDdMonYy('2026-10-28')).toBeNull();
  });
});

describe('pickTimestamp', () => {
  const stated = Date.parse('2026-10-28T00:00:00+05:30');

  test('uses receipt time on the same or next day', () => {
    const received = Date.parse('2026-10-28T14:00:00+05:30');
    expect(pickTimestamp(stated, received)).toBe(received);
  });

  test('uses stated date when SMS arrived much later', () => {
    expect(pickTimestamp(stated, Date.parse('2026-11-02T10:00:00+05:30'))).toBe(stated);
  });

  test('uses receipt time when no date was found', () => {
    expect(pickTimestamp(null, 123)).toBe(123);
  });
});

describe('senderCode', () => {
  test.each([
    ['VM-ICICIT', 'ICICIT'],
    ['AD-ICICIB-S', 'ICICIB'],
    ['icicib', 'ICICIB'],
  ])('%s -> %s', (sender, code) => {
    expect(senderCode(sender)).toBe(code);
  });
});
