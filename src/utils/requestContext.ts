import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContextData {
    userId?: string;
    userEmail?: string;
    userName?: string;
    ip?: string;
}

/**
 * AsyncLocalStorage store that carries user identity through the async call chain
 * for a single HTTP request. Used exclusively for enriching Winston log entries
 * emitted from code that doesn't have access to `req` (e.g. DAOs, service modules).
 *
 * OTel span attributes and error-span enrichment read from `req` directly and do
 * not depend on this store.
 */
export const requestContext = new AsyncLocalStorage<RequestContextData>();
