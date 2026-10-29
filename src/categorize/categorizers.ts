// The steps of the categorization chain. Contacts and heuristics are added in later phases.

import { keywordMatches } from './match';
import type { Categorizer, Rule } from './types';

/** The user answered for this payee before (or tagged it), so reuse that answer. */
export const payeeMemory: Categorizer = {
  name: 'payeeMemory',
  categorize(input) {
    if (input.payeeDefaultCategoryId != null && !input.payeeAlwaysAsk) {
      return { categoryId: input.payeeDefaultCategoryId, confidence: 1, source: 'PAYEE_MEMORY' };
    }
    return null;
  },
};

function fieldText(rule: Rule, input: { payeeName: string | null; vpa: string | null; remark: string | null }) {
  switch (rule.field) {
    case 'PAYEE_NAME':
      return input.payeeName;
    case 'VPA':
      return input.vpa;
    case 'REMARK':
      return input.remark;
  }
}

/** Highest priority first; among equals the longer (more specific) keyword first. */
export function sortRules(rules: Rule[]): Rule[] {
  return [...rules].sort(
    (a, b) => b.priority - a.priority || b.pattern.length - a.pattern.length || a.id - b.id,
  );
}

/** Keyword rules on the payee name, VPA or UPI remark. Covers seeded merchants and your own rules. */
export const keywordRules: Categorizer = {
  name: 'keywordRules',
  categorize(input, ctx) {
    if (input.payeeAlwaysAsk) {
      return null;
    }
    for (const rule of sortRules(ctx.rules)) {
      const text = fieldText(rule, input);
      if (text && keywordMatches(text, rule.pattern)) {
        return {
          categoryId: rule.categoryId,
          confidence: 0.9,
          source: rule.field === 'REMARK' ? 'REMARK' : 'RULE',
        };
      }
    }
    return null;
  },
};

/** Money received that nothing else claimed counts as Income. */
export const incomeForCredits: Categorizer = {
  name: 'incomeForCredits',
  categorize(input, ctx) {
    if (input.direction === 'CREDIT' && ctx.incomeCategoryId != null && !input.payeeAlwaysAsk) {
      return { categoryId: ctx.incomeCategoryId, confidence: 0.85, source: 'RULE' };
    }
    return null;
  },
};

export const DEFAULT_CHAIN: Categorizer[] = [payeeMemory, keywordRules, incomeForCredits];
