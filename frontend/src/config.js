// BBDRTS Centralized Client Configuration & Resilient Network Dispatcher

export const isLocalhost = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '::1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  window.location.hostname.startsWith('172.') ||
  window.location.hostname.endsWith('.local')
);

export const API_URL = import.meta.env.VITE_API_URL || (
  isLocalhost
    ? (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
        ? `http://${window.location.hostname}:3001`
        : 'http://localhost:3001')
    : 'https://bbdrts-backend-api.onrender.com'
);

/**
 * Fetch wrapper with built-in timeout and graceful error reporting.
 * Handles Render free-tier cold-start delays (up to ~30-35s) without prematurely aborting.
 */
export async function apiFetch(url, options = {}, timeoutMs = 35000) {
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
      throw new Error('Connection timed out. The cloud server may have been waking up from standby. Please try again now that it is awake.');
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}
