// Your groups (categories) and keyword rules.

import type { DB } from '@op-engineering/op-sqlite';
import type { RuleField } from '../types';

export interface Category {
  id: number;
  name: string;
  colour: string;
  isDefault: boolean;
  excludeFromTotals: boolean;
}

export interface RuleRow {
  id: number;
  field: RuleField;
  pattern: string;
  categoryId: number;
  categoryName: string;
  priority: number;
}

/** Rules you create yourself beat every built-in rule (see seedRulesV2.json). */
export const USER_RULE_PRIORITY = 50;

export async function listCategories(db: DB): Promise<Category[]> {
  const res = await db.execute(
    'SELECT id, name, colour, is_default, exclude_from_totals FROM categories ORDER BY is_default DESC, name COLLATE NOCASE',
  );
  return res.rows.map(r => ({
    id: Number(r.id),
    name: String(r.name),
    colour: String(r.colour),
    isDefault: Number(r.is_default) === 1,
    excludeFromTotals: Number(r.exclude_from_totals) === 1,
  }));
}

export class DuplicateNameError extends Error {}

async function assertNameFree(db: DB, name: string, exceptId: number | null): Promise<void> {
  const res = await db.execute(
    'SELECT id FROM categories WHERE name = ? COLLATE NOCASE AND id != ?',
    [name, exceptId ?? -1],
  );
  if (res.rows.length > 0) {
    throw new DuplicateNameError('A group with this name already exists');
  }
}

export async function addCategory(db: DB, name: string, colour: string): Promise<number> {
  const clean = name.trim();
  await assertNameFree(db, clean, null);
  const res = await db.execute(
    "INSERT INTO categories (name, icon, colour, is_default) VALUES (?, 'tag', ?, 0)",
    [clean, colour],
  );
  return res.insertId ?? -1;
}

export async function updateCategory(db: DB, id: number, name: string, colour: string): Promise<void> {
  const clean = name.trim();
  await assertNameFree(db, clean, id);
  await db.execute('UPDATE categories SET name = ?, colour = ? WHERE id = ?', [clean, colour, id]);
}

/** Payments in the group become uncategorized; its rules are deleted with it. */
export async function deleteCategory(db: DB, id: number): Promise<void> {
  await db.execute('DELETE FROM categories WHERE id = ?', [id]);
}

export async function listRules(db: DB): Promise<RuleRow[]> {
  const res = await db.execute(
    `SELECT r.id, r.match_field, r.pattern, r.category_id, r.priority, c.name
     FROM rules r JOIN categories c ON c.id = r.category_id
     ORDER BY r.priority DESC, c.name COLLATE NOCASE, r.pattern COLLATE NOCASE`,
  );
  return res.rows.map(r => ({
    id: Number(r.id),
    field: String(r.match_field) as RuleField,
    pattern: String(r.pattern),
    categoryId: Number(r.category_id),
    categoryName: String(r.name),
    priority: Number(r.priority),
  }));
}

export async function addRule(db: DB, field: RuleField, pattern: string, categoryId: number): Promise<void> {
  const clean = pattern.trim();
  if (clean === '') {
    return;
  }
  await db.execute(
    'INSERT INTO rules (match_field, pattern, category_id, priority) VALUES (?, ?, ?, ?)',
    [field, clean, categoryId, USER_RULE_PRIORITY],
  );
}

export async function deleteRule(db: DB, id: number): Promise<void> {
  await db.execute('DELETE FROM rules WHERE id = ?', [id]);
}
