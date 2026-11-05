import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * F2-02A, offline-only OAuth contract harness.
 *
 * This module NEVER opens a browser, starts a listener, exchanges a code,
 * validates an ID token or grants access to ChatGPT plan inference.
 * The callback inspection is a synthetic preflight, NOT authentication.
 */
const authorizationEndpoint = "https://auth.openai.com/api/accounts/authorize";
const callbackPath = "/auth/callback";
const oauthResource = "https://api.openai.com/v1";
const oauthScopes = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
const uuidHostId = /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxLifetimeMs = 5 * 60 * 1000;

interface PendingState {
  state: string;
  callbackUrl: string;
  expiresAt: number;
  used: boolean;
}

const pendingAttempts = new WeakMap<SiwcOfflineDraftV1, PendingState>();

export interface SiwcOfflineDraftV1 {
  readonly kind: "siwc-offline-draft";
  readonly authorizationUrl: string;
  readonly callbackUrl: string;
  readonly expiresAt: number;
  readonly connectionEnabled: false;
}

export interface SiwcOfflineCallbackResultV1 {
  readonly kind: "siwc-offline-callback-inspection";
  readonly status: "authorization-code-observed" | "denied";
  readonly issuedClientId?: string;
  readonly authenticated: false;
  readonly inferenceEnabled: false;
}

function requiredTimestamp(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid clock value");
  return value;
}

function singleQueryParam(url: URL, key: string): string | null {
  const values = url.searchParams.getAll(key);
  if (values.length > 1) throw new Error(`Duplicate OAuth callback parameter: ${key}`);
  return values.length ? values[0] : null;
}

function sameOpaqueValue(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Prepare metadata for a future OAuth attempt. No browser or network action occurs. */
export function createSiwcOfflineDraft(input: {
  hostId: string;
  callbackPort: number;
  agentName?: string;
  now?: number;
}): SiwcOfflineDraftV1 {
  if (!uuidHostId.test(input.hostId)) throw new Error("Host ID must be a persistent urn:uuid UUIDv4");
  if (!Number.isInteger(input.callbackPort) || input.callbackPort < 1024 || input.callbackPort > 65535) {
    throw new Error("Callback port must be a valid non-privileged port");
  }
  const agentName = input.agentName ?? "EVIA Office";
  if (!agentName.trim() || agentName.length > 80 || /[\r\n]/.test(agentName)) {
    throw new Error("Invalid agent name");
  }
  const now = requiredTimestamp(input.now ?? Date.now());
  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const callbackUrl = `http://127.0.0.1:${input.callbackPort}${callbackPath}`;
  const url = new URL(authorizationEndpoint);
  for (const [key, value] of Object.entries({
    client_id: "dynamic_agent_client",
    agent_name_hint: agentName,
    ext_agent_host_id: input.hostId,
    response_type: "code",
    redirect_uri: callbackUrl,
    scope: oauthScopes,
    resource: oauthResource,
    state,
    nonce,
    code_challenge_method: "S256",
    code_challenge: challenge,
  })) url.searchParams.set(key, value);
  const expiresAt = now + maxLifetimeMs;
  if (!Number.isSafeInteger(expiresAt)) throw new Error("Invalid expiration");
  const draft = Object.freeze({
    kind: "siwc-offline-draft" as const,
    authorizationUrl: url.toString(), callbackUrl, expiresAt,
    connectionEnabled: false as const,
  });
  // The one-use state is memory-only and does not expose the PKCE verifier.
  pendingAttempts.set(draft, { state, callbackUrl, expiresAt, used: false });
  return draft;
}

/** Inspect synthetic callback parameters. Never consume, persist, or echo an authorization code. */
export function inspectSiwcCallbackForHarnessOnly(
  draft: unknown, callback: string, now = Date.now(),
): SiwcOfflineCallbackResultV1 {
  if (!draft || typeof draft !== "object") throw new Error("Unknown OAuth attempt");
  const pending = pendingAttempts.get(draft as SiwcOfflineDraftV1);
  if (!pending) throw new Error("Unknown OAuth attempt");
  if (pending.used) throw new Error("OAuth attempt already consumed");
  if (requiredTimestamp(now) > pending.expiresAt) throw new Error("OAuth attempt expired");
  const url = new URL(callback);
  const expected = new URL(pending.callbackUrl);
  if (url.protocol !== expected.protocol || url.host !== expected.host || url.pathname !== expected.pathname || url.hash) {
    throw new Error("OAuth callback target mismatch");
  }
  const returnedState = singleQueryParam(url, "state");
  if (!returnedState || !sameOpaqueValue(pending.state, returnedState)) {
    throw new Error("OAuth state mismatch");
  }
  const error = singleQueryParam(url, "error");
  const code = singleQueryParam(url, "code");
  const clientId = singleQueryParam(url, "client_id");
  if (error) {
    if (error !== "access_denied" || code || clientId) throw new Error("Invalid OAuth error callback");
    pending.used = true;
    return Object.freeze({ kind: "siwc-offline-callback-inspection", status: "denied",
      authenticated: false, inferenceEnabled: false });
  }
  if (!code || !code.trim()) throw new Error("Missing OAuth authorization code");
  if (!clientId || !/^oaiapp_[A-Za-z0-9_-]{3,128}$/.test(clientId)) {
    throw new Error("Missing or invalid dynamically issued OAuth client ID");
  }
  pending.used = true;
  return Object.freeze({
    kind: "siwc-offline-callback-inspection", status: "authorization-code-observed",
    issuedClientId: clientId, authenticated: false, inferenceEnabled: false,
  });
}
