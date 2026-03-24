/**
 * Client-side rate limiter — prevents flooding the proxy/APIs.
 * Enforces a minimum delay between requests and a max concurrent limit.
 */

const MIN_INTERVAL_MS = 200; // min 200ms between requests
const MAX_CONCURRENT = 6;

let lastRequestTime = 0;
let activeCount = 0;
const queue = [];

function processQueue() {
  while (queue.length > 0 && activeCount < MAX_CONCURRENT) {
    const now = Date.now();
    const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestTime));
    if (wait > 0) {
      setTimeout(processQueue, wait);
      return;
    }
    const { resolve, fn } = queue.shift();
    activeCount++;
    lastRequestTime = Date.now();
    fn()
      .then(resolve.resolve)
      .catch(resolve.reject)
      .finally(() => {
        activeCount--;
        processQueue();
      });
  }
}

/**
 * Wraps an async function with rate limiting.
 * @param {() => Promise<T>} fn - Async function to execute
 * @returns {Promise<T>}
 */
export function rateLimited(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ resolve: { resolve, reject }, fn });
    processQueue();
  });
}

/**
 * Resets the rate limiter state (useful for tests).
 */
export function resetRateLimiter() {
  lastRequestTime = 0;
  activeCount = 0;
  queue.length = 0;
}
