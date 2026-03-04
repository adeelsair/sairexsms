import { EventEmitter } from "events";

export const ACTION_UPDATED_EVENT = "ACTION_UPDATED";

export type ActionUpdatedPayload = {
  orgId: string;
  type:
    | "FEE_COLLECTION"
    | "ABSENT_FOLLOWUP"
    | "STAFF_ATTENDANCE"
    | "ADMISSION_ENQUIRY"
    | "APPROVAL_PENDING"
    | "RESULT_PUBLISH"
    | "EXPENSE_APPROVAL";
};

const globalBus = globalThis as unknown as {
  actionEventBus?: EventEmitter;
};

export const actionEventBus = globalBus.actionEventBus ?? new EventEmitter();
actionEventBus.setMaxListeners(0);

if (!globalBus.actionEventBus) {
  globalBus.actionEventBus = actionEventBus;
}

export function emitActionUpdated(payload: ActionUpdatedPayload): void {
  actionEventBus.emit(ACTION_UPDATED_EVENT, payload);
}
