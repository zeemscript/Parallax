const COLUMNS = [
  'receipt id',
  'date',
  'repository',
  'issue number',
  'issue title',
  'pull request',
  'amount',
  'asset',
  'payout address',
];

function cell(value) {
  let text = value == null ? '' : String(value);
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** Build a spreadsheet-safe CSV document from enriched receipt rows. */
export function receiptsToCsv(rows) {
  const records = [COLUMNS, ...rows.map(row => [
    row.id,
    row.date,
    row.repository,
    row.issueNumber,
    row.issueTitle,
    row.pullRequest,
    row.amount,
    row.asset,
    row.payoutAddress,
  ])];
  return `${records.map(record => record.map(cell).join(',')).join('\r\n')}\r\n`;
}
