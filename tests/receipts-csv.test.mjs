import assert from 'node:assert/strict';
import test from 'node:test';
import { receiptsToCsv } from '../src/lib/receiptsCsv.js';

test('writes the required receipt columns and safely escapes punctuation', () => {
  const csv = receiptsToCsv([{
    id: 'rcpt-1',
    date: '2026-10-06',
    repository: 'stellar, sdk',
    issueNumber: '842',
    issueTitle: 'Fix "quoted"\nissue',
    pullRequest: 'https://github.com/stellar/sdk/pull/2',
    amount: 450,
    asset: 'USDC',
    payoutAddress: 'GADDRESS',
  }]);

  assert.equal(
    csv,
    '"receipt id","date","repository","issue number","issue title","pull request","amount","asset","payout address"\r\n'
      + '"rcpt-1","2026-10-06","stellar, sdk","842","Fix ""quoted""\nissue","https://github.com/stellar/sdk/pull/2","450","USDC","GADDRESS"\r\n',
  );
});

test('returns headers without a data row for an empty ledger', () => {
  assert.equal(receiptsToCsv([]).split('\r\n').length, 2);
});
