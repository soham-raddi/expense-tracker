import { DEFAULT_CHAIN } from './categorizers';
import {
  CONFIDENCE_THRESHOLD,
  type CategorizeContext,
  type CategorizeInput,
  type CategorizeResult,
  type Categorizer,
} from './types';

export const UNCATEGORIZED = { categoryId: null, confidence: 0, source: 'NONE' } as const;

export type ChainOutcome = CategorizeResult | typeof UNCATEGORIZED;

/** Runs the steps in order and stops at the first confident answer. */
export function runChain(
  input: CategorizeInput,
  ctx: CategorizeContext,
  chain: Categorizer[] = DEFAULT_CHAIN,
  threshold: number = CONFIDENCE_THRESHOLD,
): ChainOutcome {
  for (const step of chain) {
    const result = step.categorize(input, ctx);
    if (result && result.confidence >= threshold) {
      return result;
    }
  }
  return UNCATEGORIZED;
}
