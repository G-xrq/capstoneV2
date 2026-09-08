// BBDRTS Centralized Client Configuration & Resilient Network Dispatcher

export const API_URL = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? 'https://bbdrts-backend-api.onrender.com'
    : 'http://localhost:3001'
);

/**
 * Fetch wrapper with built-in timeout and graceful error reporting.
 * Guarantees UI loading spinners never freeze indefinitely.
 */
export async function apiFetch(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Connection timed out. The server took too long to respond. Please check your network and try again.');
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}
