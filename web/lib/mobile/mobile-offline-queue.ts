type OfflineAction = {
  type: string;
  payload: unknown;
  createdAt: string;
};

const OFFLINE_ACTIONS_KEY = "sairex.mobile.offline-actions";

function readQueue(): OfflineAction[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(OFFLINE_ACTIONS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as OfflineAction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(actions: OfflineAction[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(OFFLINE_ACTIONS_KEY, JSON.stringify(actions));
}

export async function queueOfflineAction(input: {
  type: string;
  payload: unknown;
}) {
  const queue = readQueue();
  queue.push({
    ...input,
    createdAt: new Date().toISOString(),
  });
  writeQueue(queue);
}

export function getQueuedOfflineActions(): OfflineAction[] {
  return readQueue();
}
