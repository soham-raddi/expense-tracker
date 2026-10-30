import fs from 'fs';
import path from 'path';
import { parseIciciStatement } from '../iciciStatement';

const text = fs.readFileSync(path.join(__dirname, '../../../../fixtures/pdf/icici-statement.txt'), 'utf8');

describe('parseIciciStatement', () => {
  const result = parseIciciStatement(text);
  const by = (name: string) => result.rows.find(r => r.txn.payeeName === name)!.txn;

  test('reads every row, UPI or not, and proves nothing is missing', () => {
    expect(result.rows).toHaveLength(7);
    expect(result.unreadable).toEqual([]);
    expect(result.openingPaise).toBe(1000000);
    expect(result.closingPaise).toBe(2812700);
    expect(result.totalsMatch).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.maskedAccount).toBe('XX123');
  });

  test('UPI rows keep name, VPA, ref and remark', () => {
    const t = by('Dominos Pizza');
    expect(t).toMatchObject({ mode: 'UPI', direction: 'DEBIT', amountPaise: 30000, upiRef: '661000000001', vpa: 'dominospizza@ybl', remark: null });
    expect(by('TEST FRIEND')).toMatchObject({ direction: 'CREDIT', upiRef: '661000000003', remark: 'dinner' });
  });

  test('AutoPay, standing instruction, transfer, net banking and interest rows', () => {
    expect(by('Spotify India LLP')).toMatchObject({ mode: 'AUTOPAY', upiRef: '110000000002', amountPaise: 14900 });
    expect(by('BD-TEST WEALTH PVT LT')).toMatchObject({ mode: 'AUTOPAY', direction: 'DEBIT', upiRef: null });
    expect(by('TEST PERSON ONE')).toMatchObject({ direction: 'CREDIT', amountPaise: 2000000 });
    expect(by('GOOGLEPLAY')).toMatchObject({ direction: 'DEBIT', amountPaise: 200 });
    expect(by('Interest')).toMatchObject({ direction: 'CREDIT', amountPaise: 7800 });
  });

  test('a missing row is reported, not hidden', () => {
    const broken = text.replace(/02-09-2026\nNET BANKING\nMIN\/GOOGLEPLAY \/202609021226\/968818\/\n2\.00\n9,698\.00\n/, '');
    const r = parseIciciStatement(broken);
    expect(r.complete).toBe(false);
    expect(r.unreadable.length).toBeGreaterThan(0);
  });

  test('reads the same statement when each row comes out as one line', () => {
    const inline = text
      .replace('DATE\nMODE\nPARTICULARS\nDEPOSITS\nWITHDRAWALS\nBALANCE\n', 'DATE MODE PARTICULARS DEPOSITS WITHDRAWALS BALANCE\n')
      .replace(/\n(\d{2}-\d{2}-\d{4})\n/g, '\n$1 ')
      .replace('NET BANKING\nMIN', 'NET BANKING MIN')
      .replace(/\nTotal:\n([\d,.]+)\n([\d,.]+)\n([\d,.]+)/g, '\nTotal: $1 $2 $3')
      .replace('B/F\n10,000.00', 'B/F 10,000.00');
    const r = parseIciciStatement(inline);
    expect(r.rows).toHaveLength(7);
    expect(r.complete).toBe(true);
  });
});
