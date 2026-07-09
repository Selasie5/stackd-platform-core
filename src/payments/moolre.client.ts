import { config } from '@/config/index';
import { paymentError } from '@/payments/errors';

const DEFAULT_BASE_URL = 'https://api.moolre.com';

export interface MoolreCredentials {
  apiUser?: string;
  apiKey?: string;
  apiPubKey?: string;
  accountNumber?: string;
  baseUrl?: string;
}

export interface MoolreApiResponse<T = unknown> {
  status: number | string;
  code?: string;
  message?: string | string[];
  data?: T;
  go?: unknown;
}

export interface MoolreAccountStatus {
  balance?: number;
  accountname?: string;
  callback?: string;
}

export interface MoolreAccountUpdateResult {
  status?: number;
  accountnumber?: string;
  accountname?: string;
  paymentid?: string;
  api?: number;
  callback?: string;
  secret?: string;
}

function resolveCredentials(overrides?: MoolreCredentials) {
  return {
    apiUser: overrides?.apiUser ?? config.MOOLRE_API_USER,
    apiKey: overrides?.apiKey ?? config.MOOLRE_API_KEY,
    apiPubKey: overrides?.apiPubKey ?? config.MOOLRE_API_PUBKEY,
    accountNumber: overrides?.accountNumber ?? config.MOOLRE_ACCOUNT_NUMBER,
    baseUrl: overrides?.baseUrl ?? config.MOOLRE_BASE_URL ?? DEFAULT_BASE_URL,
  };
}

function getBaseUrl(credentials?: MoolreCredentials): string {
  return resolveCredentials(credentials).baseUrl;
}

function isSandbox(credentials?: MoolreCredentials): boolean {
  return getBaseUrl(credentials).includes('sandbox');
}

function flattenMessage(message?: string | string[] | null): string {
  if (!message) return 'Unknown Moolre error';
  return Array.isArray(message) ? message.join('; ') : message;
}

function moolreHeaders(credentials?: MoolreCredentials, usePublicKey = false): Record<string, string> {
  const resolved = resolveCredentials(credentials);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (resolved.apiUser) {
    headers['X-API-USER'] = resolved.apiUser;
  }

  if (!isSandbox(credentials)) {
    const key = usePublicKey ? resolved.apiPubKey : resolved.apiKey;
    if (!key) {
      throw paymentError('MOOLRE_NOT_CONFIGURED', 'Moolre API key is not configured');
    }
    headers[usePublicKey ? 'X-API-PUBKEY' : 'X-API-KEY'] = key;
  }

  return headers;
}

async function moolrePost<T>(
  path: string,
  body: Record<string, unknown>,
  credentials?: MoolreCredentials,
  usePublicKey = false,
): Promise<MoolreApiResponse<T>> {
  const response = await fetch(`${getBaseUrl(credentials)}${path}`, {
    method: 'POST',
    headers: moolreHeaders(credentials, usePublicKey),
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as MoolreApiResponse<T>;
  if (!response.ok) {
    throw new Error(
      `Moolre ${path} failed (${response.status}): ${flattenMessage(payload.message)}`,
    );
  }

  return payload;
}

export function isMoolreConfigured(
  requireAccountNumber = true,
  credentials?: MoolreCredentials,
): boolean {
  const resolved = resolveCredentials(credentials);
  const hasAuth = Boolean(resolved.apiUser && resolved.apiKey);
  if (!requireAccountNumber) return hasAuth;
  return hasAuth && Boolean(resolved.accountNumber);
}

export async function getMoolreAccountStatus(
  credentials?: MoolreCredentials,
): Promise<MoolreAccountStatus> {
  if (!isMoolreConfigured(true, credentials)) {
    throw paymentError('MOOLRE_NOT_CONFIGURED', 'Moolre is not configured');
  }

  const resolved = resolveCredentials(credentials);
  const result = await moolrePost<MoolreAccountStatus>(
    '/open/account/status',
    {
      type: 1,
      accountnumber: resolved.accountNumber,
    },
    credentials,
  );

  if (Number(result.status) !== 1) {
    throwMoolreError(result);
  }

  return result.data ?? {};
}

function throwMoolreError(result: MoolreApiResponse): never {
  const code = result.code ?? 'UNKNOWN';
  const message = flattenMessage(result.message);
  if (code === 'AIN01') {
    throw new Error(
      `${message} (${code}). Use your Moolre Private API Key in MOOLRE_API_KEY — the wallet secret is not the API key.`,
    );
  }
  if (code === 'AIN04') {
    throw new Error(
      `${message} (${code}). Run npm run moolre:activate after MOOLRE_API_KEY is set to enable wallet API access.`,
    );
  }
  throw new Error(`${message} (${code})`);
}

export async function activateMoolreWallet(
  options?: {
    callback?: string;
    accountName?: string;
    credentials?: MoolreCredentials;
  },
): Promise<MoolreAccountUpdateResult> {
  if (!isMoolreConfigured(true, options?.credentials)) {
    throw paymentError('MOOLRE_NOT_CONFIGURED', 'Moolre is not configured');
  }

  const resolved = resolveCredentials(options?.credentials);
  const body: Record<string, unknown> = {
    type: 1,
    accountnumber: resolved.accountNumber,
    api: true,
  };

  if (options?.callback) body.callback = options.callback;
  if (options?.accountName) body.accountname = options.accountName;

  const result = await moolrePost<MoolreAccountUpdateResult>(
    '/open/account/update',
    body,
    options?.credentials,
  );

  if (Number(result.status) !== 1) {
    throwMoolreError(result);
  }

  return result.data ?? {};
}

export { moolrePost, flattenMessage };
