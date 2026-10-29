import type { CategorySource, Direction, RuleField } from '../data/types';

/** What the categorizers know about one transaction. */
export interface CategorizeInput {
  direction: Direction;
  payeeName: string | null;
  vpa: string | null;
  remark: string | null;
  payeeDefaultCategoryId: number | null;
  payeeAlwaysAsk: boolean;
}

export interface Rule {
  id: number;
  field: RuleField;
  pattern: string;
  categoryId: number;
  priority: number;
}

/** Shared lookups, loaded once per batch. */
export interface CategorizeContext {
  rules: Rule[];
  incomeCategoryId: number | null;
}

export interface CategorizeResult {
  categoryId: number;
  confidence: number; // 0-1
  source: CategorySource;
}

/** One step in the chain. Returns null when it has no opinion. */
export interface Categorizer {
  name: string;
  categorize(input: CategorizeInput, ctx: CategorizeContext): CategorizeResult | null;
}

export const CONFIDENCE_THRESHOLD = 0.8;
