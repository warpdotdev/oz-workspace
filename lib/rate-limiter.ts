/**
 * Global rate limiter for Warp API requests.
 *
 * Coordinates all outgoing requests to prevent Cloud Armor 429s when
 * multiple agents are polling simultaneously.
 */

type QueuedRequest<T> = {
  fn: () => Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

class WarpAPIRateLimiter {
  private queue: QueuedRequest<unknown>[] = []
  private processing = false
  private minDelayMs: number
  private lastRequestTime = 0

  constructor(minDelayMs = 300) {
    this.minDelayMs = minDelayMs
  }

  /**
   * Enqueue a request to be executed with rate limiting.
   * Requests are processed sequentially with a minimum delay between them.
   */
  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        fn,
        resolve: resolve as (value: unknown) => void,
        reject,
      })
      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true

    while (this.queue.length > 0) {
      const request = this.queue.shift()!

      // Ensure minimum delay between requests
      const elapsed = Date.now() - this.lastRequestTime
      if (elapsed < this.minDelayMs) {
        await new Promise((r) => setTimeout(r, this.minDelayMs - elapsed))
      }

      try {
        this.lastRequestTime = Date.now()
        const result = await request.fn()
        request.resolve(result)
      } catch (error) {
        request.reject(error)
      }
    }

    this.processing = false
  }

  /**
   * Get current queue depth for monitoring.
   */
  get queueDepth(): number {
    return this.queue.length
  }
}

// Singleton instance - 300ms minimum between requests allows ~3 req/sec
// which should stay well under Cloud Armor limits even with multiple agents
export const warpRateLimiter = new WarpAPIRateLimiter(300)
