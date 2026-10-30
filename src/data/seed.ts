// Seeds default categories and merchant rules from the config files.

import type { Transaction } from '@op-engineering/op-sqlite';
import categories from '../config/categories.json';
import seedRules from '../config/seedRules.json';
import seedRulesV2Config from '../config/seedRulesV2.json';

export async function seedDefaults(tx: Transaction): Promise<void> {
  for (const c of categories) {
    await tx.execute(
      'INSERT INTO categories (name, icon, colour, is_default) VALUES (?, ?, ?, 1)',
      [c.name, c.icon, c.colour],
    );
  }
  for (const r of seedRules) {
    const res = await tx.execute('SELECT id FROM categories WHERE name = ?', [
      r.category,
    ]);
    const categoryId = res.rows[0]?.id;
    if (categoryId == null) {
      throw new Error(`Seed rule refers to unknown category: ${r.category}`);
    }
    for (const keyword of r.keywords) {
      await tx.execute(
        'INSERT INTO rules (match_field, pattern, category_id, priority) VALUES (?, ?, ?, 0)',
        [r.field, keyword, categoryId],
      );
    }
  }
}

/** Migration 3: more merchants, generic business words and remark keywords. */
export async function seedRulesV2(tx: Transaction): Promise<void> {
  for (const group of seedRulesV2Config.rules) {
    const res = await tx.execute('SELECT id FROM categories WHERE name = ?', [group.category]);
    const categoryId = res.rows[0]?.id;
    if (categoryId == null) {
      continue; // the user deleted or renamed this default group; skip its rules
    }
    for (const keyword of group.keywords) {
      const exists = await tx.execute(
        'SELECT id FROM rules WHERE match_field = ? AND pattern = ? AND category_id = ?',
        [group.field, keyword, categoryId],
      );
      if (exists.rows.length === 0) {
        await tx.execute(
          'INSERT INTO rules (match_field, pattern, category_id, priority) VALUES (?, ?, ?, ?)',
          [group.field, keyword, categoryId, group.priority],
        );
      }
    }
  }
}

/**
 * Migration 7: "Friends / Splits" becomes "Friends" (people you know), and "Other people" is added
 * for people you pay only once or twice. A name you already changed is left alone.
 */
export async function refineGroups(tx: Transaction): Promise<void> {
  await tx.execute(
    `UPDATE categories SET name = 'Friends'
     WHERE name = 'Friends / Splits' AND is_default = 1
       AND NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Friends')`,
  );
  const existing = await tx.execute("SELECT id FROM categories WHERE name = 'Other people'");
  if (existing.rows.length === 0) {
    await tx.execute(
      "INSERT INTO categories (name, icon, colour, is_default) VALUES ('Other people', 'users', '#8E6BBF', 1)",
    );
  }
}
