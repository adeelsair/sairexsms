import { InvoiceStatus } from "../payments.types";

const ALLOWED_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.PENDING]: [
    InvoiceStatus.PENDING,
    InvoiceStatus.PARTIAL,
    InvoiceStatus.PAID,
    InvoiceStatus.CANCELLED,
  ],
  [InvoiceStatus.PARTIAL]: [
    InvoiceStatus.PARTIAL,
    InvoiceStatus.PAID,
  ],
  [InvoiceStatus.PAID]: [
    InvoiceStatus.PAID,
    InvoiceStatus.REFUNDED,
  ],
  [InvoiceStatus.REFUNDED]: [InvoiceStatus.REFUNDED],
  [InvoiceStatus.EXPIRED]: [InvoiceStatus.EXPIRED],
  [InvoiceStatus.CANCELLED]: [InvoiceStatus.CANCELLED],
};

export function canTransitionInvoiceStatus(current: InvoiceStatus, next: InvoiceStatus): boolean {
  return ALLOWED_TRANSITIONS[current]?.includes(next) ?? false;
}

export function assertInvoiceStatusTransition(current: InvoiceStatus, next: InvoiceStatus) {
  if (!canTransitionInvoiceStatus(current, next)) {
    throw new Error(`Invalid invoice state transition: ${current} -> ${next}`);
  }
}

