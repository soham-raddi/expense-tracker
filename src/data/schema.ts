// SQLite schema. Each entry is one migration; never edit an old one, append a new one.

export const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL,
      colour TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE payees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vpa TEXT UNIQUE,
      display_name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'UNKNOWN',
      relation TEXT,
      default_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      always_ask INTEGER NOT NULL DEFAULT 0,
      contact_lookup_key TEXT
    )`,
    `CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount_paise INTEGER NOT NULL,
      direction TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      mode TEXT NOT NULL,
      payee_id INTEGER REFERENCES payees(id) ON DELETE SET NULL,
      upi_ref TEXT UNIQUE,
      masked_account TEXT,
      remark TEXT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      category_source TEXT NOT NULL DEFAULT 'NONE',
      confidence REAL NOT NULL DEFAULT 0,
      source TEXT NOT NULL,
      raw_text TEXT NOT NULL,
      lat REAL,
      lng REAL
    )`,
    'CREATE INDEX idx_txn_timestamp ON transactions(timestamp)',
    'CREATE INDEX idx_txn_payee ON transactions(payee_id)',
    `CREATE TABLE rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_field TEXT NOT NULL,
      pattern TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      priority INTEGER NOT NULL DEFAULT 0
    )`,
    // Bank SMS that no parser could read. Kept so nothing is silently dropped.
    `CREATE TABLE unparsed_sms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT NOT NULL,
      body TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      UNIQUE(sender, timestamp, body)
    )`,
  ],
  [
    // Running balance from statements; used to tell identical same-day payments apart.
    'ALTER TABLE transactions ADD COLUMN balance_paise INTEGER',
    // One row per statement import. The file itself is never kept, only these counts.
    `CREATE TABLE statement_imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      imported_at INTEGER NOT NULL,
      bank_id TEXT NOT NULL,
      masked_account TEXT,
      from_date INTEGER NOT NULL,
      to_date INTEGER NOT NULL,
      rows_read INTEGER NOT NULL,
      rows_matched INTEGER NOT NULL,
      rows_new INTEGER NOT NULL,
      rows_failed INTEGER NOT NULL
    )`,
  ],
  [
    // Categories that must not count towards spending totals, e.g. money moved between own accounts.
    'ALTER TABLE categories ADD COLUMN exclude_from_totals INTEGER NOT NULL DEFAULT 0',
    "UPDATE categories SET exclude_from_totals = 1 WHERE name = 'Transfers (self)'",
    // More seed rules are inserted from src/config/seedRulesV2.json in db.ts.
  ],
  [
    // A name you give a payee yourself, e.g. a friend whose UPI account is in her father's name.
    // display_name stays what the bank sent, so you can always see it.
    'ALTER TABLE payees ADD COLUMN custom_name TEXT',
  ],
  [
    // A dismissed message stays in the table so a later inbox scan does not bring it back.
    'ALTER TABLE unparsed_sms ADD COLUMN dismissed INTEGER NOT NULL DEFAULT 0',
  ],
  [
    // Small app settings, e.g. "do not import messages older than this".
    `CREATE TABLE app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    // Remembers that a payment was deleted so a later inbox scan does not bring it back.
    // It keeps a fingerprint of the message, never the message text.
    `CREATE TABLE deleted_txns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upi_ref TEXT,
      text_hash TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    )`,
    'CREATE INDEX idx_deleted_ref ON deleted_txns(upi_ref)',
  ],
];
