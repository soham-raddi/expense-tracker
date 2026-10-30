import { cleanCustomName, cleanNote, matchText, shownName } from '../names';

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

describe('cleanNote', () => {
  test('trims, keeps line breaks, limits length and treats blank as no note', () => {
    expect(cleanNote('  lunch   with  Priya ')).toBe('lunch with Priya');
    expect(cleanNote('line one' + String.fromCharCode(10) + 'line two')).toBe('line one' + String.fromCharCode(10) + 'line two');
    expect(cleanNote(' ' + String.fromCharCode(10) + ' ')).toBeNull();
    expect(cleanNote('x'.repeat(500))).toHaveLength(200);
  });
});
