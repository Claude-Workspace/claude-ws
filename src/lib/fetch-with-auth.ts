import { getStoredApiKey } from '../components/auth/api-key-dialog';

/**
 * Wrapper around fetch that automatically includes API key in headers
 * if authentication is enabled and a key is stored
 */
export async function fetchWithAuth(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const apiKey = getStoredApiKey();

  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> || {}),
  };

  // Add API key if available
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Helper for GET requests with auth
 */
export async function fetchGet(url: string): Promise<Response> {
  return fetchWithAuth(url, { method: 'GET' });
}

/**
 * Helper for POST requests with auth
 */
export async function fetchPost(
  url: string,
  body: unknown
): Promise<Response> {
  return fetchWithAuth(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Helper for PUT requests with auth
 */
export async function fetchPut(
  url: string,
  body: unknown
): Promise<Response> {
  return fetchWithAuth(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Helper for PATCH requests with auth
 */
export async function fetchPatch(
  url: string,
  body: unknown
): Promise<Response> {
  return fetchWithAuth(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Helper for DELETE requests with auth
 */
export async function fetchDelete(url: string): Promise<Response> {
  return fetchWithAuth(url, { method: 'DELETE' });
}
