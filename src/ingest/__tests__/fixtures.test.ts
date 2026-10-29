/// <reference types="node" />
// Runs every case in fixtures/sms/*.json through the real routing + parser.
// A new bank gets coverage just by adding its fixture file.

import fs from 'fs';
import path from 'path';
import { routeSms } from '../registry';

interface FixtureCase {
  name: string;
  sender: string;
  receivedAt: string;
  body: string;
  expect:
    | { kind: 'txn'; txn: Record<string, unknown> }
    | { kind: 'unparsed' }
    | { kind: 'ignored' };
}

const dir = path.join(__dirname, '../../../fixtures/sms');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

describe.each(files)('fixtures/sms/%s', file => {
  const { cases } = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as {
    cases: FixtureCase[];
  };

  test.each(cases.map(c => [c.name, c] as const))('%s', (_name, c) => {
    const result = routeSms({
      sender: c.sender,
      body: c.body,
      timestamp: Date.parse(c.receivedAt),
    });
    expect(result.kind).toBe(c.expect.kind);
    if (c.expect.kind === 'txn' && result.kind === 'txn') {
      const expected = { ...c.expect.txn };
      if (typeof expected.timestamp === 'string') {
        expected.timestamp = Date.parse(expected.timestamp);
      }
      expect(result.txn).toMatchObject(expected);
      expect(result.txn.rawText).toBe(c.body);
    }
  });
});
