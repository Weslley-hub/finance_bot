import { Injectable } from '@nestjs/common';
import {
  CategorizationSource,
  TransactionSource,
  TransactionType,
} from '@prisma/client';
import { InvoiceItemStatus } from '../documents/card-invoice';
import { PaymentType } from '../documents/payment-classification';
import { DuplicateHit } from '../transactions/duplicate';
import { CreateTransactionInput } from '../transactions/transactions.service';

export type PendingDraft = {
  id: string;
  familyId: string;
  userId: string;
  type: TransactionType;
  amount: number;
  description: string;
  merchant?: string;
  rawText: string;
  categoryId: string;
  source: TransactionSource;
  categorizationSource: CategorizationSource;
  confidence?: number;
};

export type PendingReceiptDraft = {
  id: string;
  familyId: string;
  userId: string;
  amount: number;
  paidAt?: Date | null;
  destination?: string | null;
  bank?: string | null;
  originBank?: string | null;
  destinationBank?: string | null;
  paymentType?: PaymentType | null;
  movementType: TransactionType;
  categoryId: string;
  documentId?: string;
  source: TransactionSource;
  categorizationSource: CategorizationSource;
};

export type PendingBillDraft = {
  id: string;
  familyId: string;
  userId: string;
  amount: number;
  dueDate?: Date | null;
  supplier: string;
  barcode?: string | null;
  categoryId: string;
  referenceMonth: number;
  referenceYear: number;
  documentId?: string;
  source: TransactionSource;
};

export type PendingInvoiceItem = {
  merchant: string;
  amount: number;
  date: Date | null;
  categoryId: string;
  categoryName: string;
  description: string;
  source: CategorizationSource;
  confidence: number;
  status: InvoiceItemStatus;
};

export type PendingInvoiceDraft = {
  id: string;
  familyId: string;
  userId: string;
  cardName: string;
  fileName?: string;
  documentId?: string;
  items: PendingInvoiceItem[];
};

export type PendingDuplicateDraft = {
  id: string;
  linkCard: boolean;
  existing: DuplicateHit;
  payload: CreateTransactionInput;
};

@Injectable()
export class PendingMovementsStore {
  private readonly drafts = new Map<string, PendingDraft>();
  private readonly receipts = new Map<string, PendingReceiptDraft>();
  private readonly bills = new Map<string, PendingBillDraft>();
  private readonly invoices = new Map<string, PendingInvoiceDraft>();
  private readonly duplicates = new Map<string, PendingDuplicateDraft>();

  save(draft: PendingDraft): void {
    this.drafts.set(draft.id, draft);
  }

  consume(id: string): PendingDraft | undefined {
    const draft = this.drafts.get(id);
    this.drafts.delete(id);
    return draft;
  }

  saveReceipt(draft: PendingReceiptDraft): void {
    this.receipts.set(draft.id, draft);
  }

  consumeReceipt(id: string): PendingReceiptDraft | undefined {
    const draft = this.receipts.get(id);
    this.receipts.delete(id);
    return draft;
  }

  saveBill(draft: PendingBillDraft): void {
    this.bills.set(draft.id, draft);
  }

  consumeBill(id: string): PendingBillDraft | undefined {
    const draft = this.bills.get(id);
    this.bills.delete(id);
    return draft;
  }

  saveInvoice(draft: PendingInvoiceDraft): void {
    this.invoices.set(draft.id, draft);
  }

  peekInvoice(id: string): PendingInvoiceDraft | undefined {
    return this.invoices.get(id);
  }

  consumeInvoice(id: string): PendingInvoiceDraft | undefined {
    const draft = this.invoices.get(id);
    this.invoices.delete(id);
    return draft;
  }

  saveDuplicate(draft: PendingDuplicateDraft): void {
    this.duplicates.set(draft.id, draft);
  }

  consumeDuplicate(id: string): PendingDuplicateDraft | undefined {
    const draft = this.duplicates.get(id);
    this.duplicates.delete(id);
    return draft;
  }
}
