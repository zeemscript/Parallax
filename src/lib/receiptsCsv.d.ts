export interface ReceiptCsvRow {
  id: string;
  date: string;
  repository: string;
  issueNumber: string;
  issueTitle: string;
  pullRequest: string;
  amount: number;
  asset: string;
  payoutAddress: string;
}

export function receiptsToCsv(rows: readonly ReceiptCsvRow[]): string;
