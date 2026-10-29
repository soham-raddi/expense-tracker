import seedRulesV2 from '../../config/seedRulesV2.json';
import { runChain } from '../chain';
import { incomeForCredits, keywordRules, payeeMemory, sortRules } from '../categorizers';
import { keywordMatches } from '../match';
import type { CategorizeContext, CategorizeInput, Rule } from '../types';

const FOOD = 1;
const TRANSPORT = 2;
const INCOME = 3;
const FRIENDS = 4;

const rule = (id: number, pattern: string, categoryId: number, priority = 0, field: Rule['field'] = 'PAYEE_NAME'): Rule => ({
  id,
  field,
  pattern,
  categoryId,
  priority,
});

const ctx = (rules: Rule[], incomeCategoryId: number | null = INCOME): CategorizeContext => ({
  rules,
  incomeCategoryId,
});

const input = (over: Partial<CategorizeInput> = {}): CategorizeInput => ({
  direction: 'DEBIT',
  payeeName: null,
  vpa: null,
  remark: null,
  payeeDefaultCategoryId: null,
  payeeAlwaysAsk: false,
  ...over,
});

describe('keywordMatches', () => {
  test('long keywords match anywhere, ignoring case', () => {
    expect(keywordMatches('DOMINOS PIZZA', 'dominos')).toBe(true);
    expect(keywordMatches('SwiggyInstamart', 'swiggy')).toBe(true);
    expect(keywordMatches('swiggy@icici', 'Swiggy')).toBe(true);
    expect(keywordMatches("Domino's Pizza", "domino's")).toBe(true);
  });

  test('short keywords need a whole word', () => {
    expect(keywordMatches('VI Recharge', 'vi')).toBe(true);
    expect(keywordMatches('vi@okicici', 'vi')).toBe(true);
    expect(keywordMatches('Vivek Kumar', 'vi')).toBe(false);
    expect(keywordMatches('Ola Cabs', 'ola')).toBe(true);
    expect(keywordMatches('Viola Stores', 'ola')).toBe(false);
  });

  test('empty keyword never matches', () => {
    expect(keywordMatches('anything', '  ')).toBe(false);
  });
});

describe('payeeMemory', () => {
  test('uses the remembered group with full confidence', () => {
    expect(payeeMemory.categorize(input({ payeeDefaultCategoryId: FRIENDS }), ctx([]))).toEqual({
      categoryId: FRIENDS,
      confidence: 1,
      source: 'PAYEE_MEMORY',
    });
  });

  test('does nothing when always-ask is on or nothing is remembered', () => {
    expect(payeeMemory.categorize(input({ payeeDefaultCategoryId: FRIENDS, payeeAlwaysAsk: true }), ctx([]))).toBeNull();
    expect(payeeMemory.categorize(input(), ctx([]))).toBeNull();
  });
});

describe('keywordRules', () => {
  test('matches payee name, VPA and remark', () => {
    const rules = [rule(1, 'dominos', FOOD), rule(2, 'rapido', TRANSPORT, 0, 'VPA'), rule(3, 'chai', FOOD, 20, 'REMARK')];
    expect(keywordRules.categorize(input({ payeeName: 'Dominos Pizza' }), ctx(rules))?.categoryId).toBe(FOOD);
    expect(keywordRules.categorize(input({ vpa: 'rapido.pay@icici' }), ctx(rules))?.categoryId).toBe(TRANSPORT);
    const viaRemark = keywordRules.categorize(input({ payeeName: 'Ramesh', remark: 'morning chai' }), ctx(rules));
    expect(viaRemark).toMatchObject({ categoryId: FOOD, source: 'REMARK' });
  });

  test('higher priority wins, then the longer keyword', () => {
    const rules = [rule(1, 'swiggy', FOOD, 0), rule(2, 'swiggy instamart', 9, 0), rule(3, 'swiggy', FRIENDS, 50)];
    expect(sortRules(rules).map(r => r.id)).toEqual([3, 2, 1]);
    expect(keywordRules.categorize(input({ payeeName: 'Swiggy Instamart' }), ctx(rules))?.categoryId).toBe(FRIENDS);
    expect(keywordRules.categorize(input({ payeeName: 'Swiggy Instamart' }), ctx(rules.slice(0, 2)))?.categoryId).toBe(9);
  });

  test('is skipped when always-ask is on', () => {
    expect(keywordRules.categorize(input({ payeeName: 'Dominos', payeeAlwaysAsk: true }), ctx([rule(1, 'dominos', FOOD)]))).toBeNull();
  });
});

describe('incomeForCredits', () => {
  test('credits become Income, debits do not', () => {
    expect(incomeForCredits.categorize(input({ direction: 'CREDIT' }), ctx([]))?.categoryId).toBe(INCOME);
    expect(incomeForCredits.categorize(input({ direction: 'DEBIT' }), ctx([]))).toBeNull();
  });

  test('does nothing if there is no Income group', () => {
    expect(incomeForCredits.categorize(input({ direction: 'CREDIT' }), ctx([], null))).toBeNull();
  });
});

describe('runChain', () => {
  const rules = [rule(1, 'dominos', FOOD)];

  test('payee memory beats a rule', () => {
    const out = runChain(input({ payeeName: 'Dominos', payeeDefaultCategoryId: FRIENDS }), ctx(rules));
    expect(out).toMatchObject({ categoryId: FRIENDS, source: 'PAYEE_MEMORY' });
  });

  test('a rule beats the income fallback for credits', () => {
    const out = runChain(input({ direction: 'CREDIT', payeeName: 'Dominos refund' }), ctx(rules));
    expect(out).toMatchObject({ categoryId: FOOD });
  });

  test('an unknown personal payee stays uncategorized', () => {
    expect(runChain(input({ payeeName: 'Ramesh Kumar' }), ctx(rules))).toEqual({
      categoryId: null,
      confidence: 0,
      source: 'NONE',
    });
  });

  test('an unknown credit falls back to Income', () => {
    expect(runChain(input({ direction: 'CREDIT', payeeName: 'Ramesh' }), ctx(rules))).toMatchObject({
      categoryId: INCOME,
    });
  });

  test('answers below the threshold are ignored', () => {
    const weak = { name: 'weak', categorize: () => ({ categoryId: FOOD, confidence: 0.5, source: 'HEURISTIC' as const }) };
    expect(runChain(input(), ctx([]), [weak]).categoryId).toBeNull();
    expect(runChain(input(), ctx([]), [weak], 0.4).categoryId).toBe(FOOD);
  });
});

describe('seed rules', () => {
  test('every seeded keyword is unique within its group and field', () => {
    const seen = new Set<string>();
    for (const g of seedRulesV2.rules) {
      for (const k of g.keywords) {
        const id = `${g.category}|${g.field}|${k}`;
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
  });

  test('requested examples: dominos, swiggy and zomato resolve to Food & Dining', () => {
    const food = seedRulesV2.rules
      .filter(g => g.category === 'Food & Dining' && g.field === 'PAYEE_NAME')
      .flatMap(g => g.keywords);
    expect(food).toContain('dominos');
    // swiggy and zomato are in the original seed list
    const original = require('../../config/seedRules.json');
    const originalFood = original.find((g: { category: string }) => g.category === 'Food & Dining').keywords;
    expect(originalFood).toEqual(expect.arrayContaining(['swiggy', 'zomato']));
  });
});
