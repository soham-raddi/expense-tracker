// Connects the categorizer chain to the database.

import type { DB } from '@op-engineering/op-sqlite';
import { runChain, type ChainOutcome } from '../../categorize/chain';
import type { CategorizeContext, CategorizeInput, Rule } from '../../categorize/types';
import { matchText } from '../../lib/names';
import type { Direction, RuleField } from '../types';

export async function loadContext(db: DB): Promise<CategorizeContext> {
  const rules = await db.execute('SELECT id, match_field, pattern, category_id, priority FROM rules');
  const income = await db.execute("SELECT id FROM categories WHERE name = 'Income'");
  return {
    rules: rules.rows.map(
      (r): Rule => ({
        id: Number(r.id),
        field: String(r.match_field) as RuleField,
        pattern: String(r.pattern),
        categoryId: Number(r.category_id),
        priority: Number(r.priority),
      }),
    ),
    incomeCategoryId: income.rows[0]?.id == null ? null : Number(income.rows[0].id),
  };
}

export function categorize(input: CategorizeInput, ctx: CategorizeContext): ChainOutcome {
  return runChain(input, ctx);
}

/** Runs the chain on every payment that has no group yet. Called at startup and after rule changes. */
export async function recategorizeUncategorized(db: DB): Promise<number> {
  const ctx = await loadContext(db);
  const res = await db.execute(
    `SELECT t.id, t.direction, t.remark, p.display_name, p.custom_name, p.vpa, p.default_category_id, p.always_ask
     FROM transactions t LEFT JOIN payees p ON p.id = t.payee_id
     WHERE t.category_id IS NULL`,
  );
  let changed = 0;
  for (const r of res.rows) {
    const outcome = categorize(
      {
        direction: r.direction === 'CREDIT' ? 'CREDIT' : ('DEBIT' as Direction),
        payeeName: matchText(
          r.display_name == null ? null : String(r.display_name),
          r.custom_name == null ? null : String(r.custom_name),
        ),
        vpa: r.vpa == null ? null : String(r.vpa),
        remark: r.remark == null ? null : String(r.remark),
        payeeDefaultCategoryId: r.default_category_id == null ? null : Number(r.default_category_id),
        payeeAlwaysAsk: Number(r.always_ask) === 1,
      },
      ctx,
    );
    if (outcome.categoryId != null) {
      await db.execute(
        'UPDATE transactions SET category_id = ?, category_source = ?, confidence = ? WHERE id = ?',
        [outcome.categoryId, outcome.source, outcome.confidence, r.id as number],
      );
      changed++;
    }
  }
  return changed;
}

/**
 * You picked a group for a payment. With `applyToPayee`, every payment to that payee, past and
 * future, gets the group (remembered on the payee).
 */
export async function setUserCategory(
  db: DB,
  txnId: number,
  categoryId: number,
  applyToPayee: boolean,
): Promise<void> {
  const row = await db.execute('SELECT payee_id FROM transactions WHERE id = ?', [txnId]);
  const payeeId = row.rows[0]?.payee_id == null ? null : Number(row.rows[0].payee_id);
  if (applyToPayee && payeeId != null) {
    await db.execute('UPDATE payees SET default_category_id = ?, always_ask = 0 WHERE id = ?', [categoryId, payeeId]);
    await db.execute(
      "UPDATE transactions SET category_id = ?, category_source = 'PAYEE_MEMORY', confidence = 1 WHERE payee_id = ?",
      [categoryId, payeeId],
    );
    // The payment you tapped is a direct answer from you.
    await db.execute("UPDATE transactions SET category_source = 'USER' WHERE id = ?", [txnId]);
  } else {
    await db.execute(
      "UPDATE transactions SET category_id = ?, category_source = 'USER', confidence = 1 WHERE id = ?",
      [categoryId, txnId],
    );
  }
}

/** "Always ask" payees are never categorized automatically; their payments are cleared. */
export async function setAlwaysAsk(db: DB, payeeId: number, alwaysAsk: boolean): Promise<void> {
  await db.execute('UPDATE payees SET always_ask = ? WHERE id = ?', [alwaysAsk ? 1 : 0, payeeId]);
}

export async function clearCategory(db: DB, txnId: number): Promise<void> {
  await db.execute(
    "UPDATE transactions SET category_id = NULL, category_source = 'NONE', confidence = 0 WHERE id = ?",
    [txnId],
  );
}
