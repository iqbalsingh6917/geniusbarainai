import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContext = {
  requestId: string;
  counts: {
    queryCount: number;
    slowQueryCount: number;
  };
  cache: Map<string, unknown>;
  label?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext(requestId: string, fn: () => void) {
  storage.run(
    {
      requestId,
      counts: {
        queryCount: 0,
        slowQueryCount: 0,
      },
      cache: new Map(),
    },
    fn
  );
}

export async function withQueryLabel<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const store = storage.getStore();
  if (!store) {
    return fn();
  }
  return storage.run(
    {
      ...store,
      label,
    },
    async () => await fn()
  );
}

export function getRequestContext() {
  return storage.getStore();
}

export function incrementQueryCount() {
  const store = storage.getStore();
  if (store) {
    store.counts.queryCount += 1;
  }
}

export function incrementSlowQueryCount() {
  const store = storage.getStore();
  if (store) {
    store.counts.slowQueryCount += 1;
  }
}

export function getRequestCache() {
  return storage.getStore()?.cache;
}
