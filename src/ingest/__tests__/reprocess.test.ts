// All messages are synthetic.
import { planReprocess, type UnparsedItem } from '../reprocess';

const at = Date.parse('2026-10-28T12:00:00+05:30');
const item = (id: number, body: string, sender = 'VM-ICICIT'): UnparsedItem => ({ id, sender, body, timestamp: at });

describe('planReprocess', () => {
  const readable = item(
    1,
    'Rs. 70.00 debited from ICICI Bank Acc XX123 on 11-Sep-26 MIN*Retail  C. Bal Rs. 1,234.56. If not you call 18002662',
  );
  const notice = item(
    2,
    'ICICI Bank SAVINGS Account XX123 will be debited for Rs 89.00 on 26-Oct-26 towards Autopay for TestApp',
  );
  const stillUnknown = item(3, 'Your account XX123 has been debited Rs 500.00 by an unknown format.');

  test('saves what is now readable, drops notices, keeps what is still unreadable', () => {
    const plan = planReprocess([readable, notice, stillUnknown]);
    expect(plan.toSave.map(s => s.id)).toEqual([1]);
    expect(plan.toSave[0].txn).toMatchObject({ amountPaise: 7000, direction: 'DEBIT', payeeName: 'MIN*Retail' });
    expect(plan.toDelete).toEqual([2]);
  });

  test('an empty list needs no work', () => {
    expect(planReprocess([])).toEqual({ toSave: [], toDelete: [] });
  });

  test('a sender that is not a known bank is dropped from the list', () => {
    expect(planReprocess([item(4, readable.body, 'VM-NOTABANK')]).toDelete).toEqual([4]);
  });
});
