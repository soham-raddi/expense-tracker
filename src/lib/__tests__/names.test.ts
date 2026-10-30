import { cleanCustomName, matchText, shownName } from '../names';

describe('shownName', () => {
  test('your name wins, otherwise the bank name', () => {
    expect(shownName('TEST FATHER NAME', 'Priya')).toBe('Priya');
    expect(shownName('TEST FATHER NAME', null)).toBe('TEST FATHER NAME');
    expect(shownName('TEST FATHER NAME', '   ')).toBe('TEST FATHER NAME');
    expect(shownName(null, null)).toBeNull();
  });
});

describe('matchText', () => {
  test('rules can match either name', () => {
    expect(matchText('TEST FATHER', 'Priya')).toBe('TEST FATHER Priya');
    expect(matchText('TEST FATHER', null)).toBe('TEST FATHER');
    expect(matchText(null, 'Priya')).toBe('Priya');
    expect(matchText(null, null)).toBeNull();
  });
});

describe('cleanCustomName', () => {
  test('trims, squeezes spaces, limits length and treats blank as cleared', () => {
    expect(cleanCustomName('  Priya   Rao ')).toBe('Priya Rao');
    expect(cleanCustomName('   ')).toBeNull();
    expect(cleanCustomName('x'.repeat(100))).toHaveLength(40);
  });
});
