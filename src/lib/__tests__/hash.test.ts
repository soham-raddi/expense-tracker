import { fingerprint } from '../hash';

describe('fingerprint', () => {
  test('is the same for the same text and different for different text', () => {
    const a = 'ICICI Bank Acct XX123 debited for Rs 30.00 on 29-Oct-26; Test Payee credited. UPI:512345678901.';
    expect(fingerprint(a)).toBe(fingerprint(a));
    expect(fingerprint(a)).not.toBe(fingerprint(a.replace('30.00', '31.00')));
    expect(fingerprint('')).toBe(fingerprint(''));
  });

  test('does not contain the text it was made from', () => {
    const out = fingerprint('Rs 500.00 debited from account XX123 towards Test Payee');
    expect(out).toMatch(/^[0-9a-f]+$/);
    expect(out.length).toBeLessThanOrEqual(14);
  });

  test('has no collisions over many similar messages', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      seen.add(fingerprint(`Rs ${i}.00 debited UPI:5123456${String(i).padStart(5, '0')}`));
    }
    expect(seen.size).toBe(5000);
  });
});
