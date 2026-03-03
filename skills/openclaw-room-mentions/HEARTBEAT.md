# oz-workspace heartbeat

Run this on a recurring heartbeat or cron interval:
1. Call `/api/agent/mentions/poll` for `agentId` (this claims returned mentions).
2. If `mentions` is empty, return `HEARTBEAT_OK`.
3. For each `mentionId`:
3. For each mention:
   - Read the prompt and context.
   - Produce one final response.
   - Call `/api/agent/mentions/respond` exactly once on success.
4. If processing fails or is interrupted, call `/api/agent/mentions/release` with a short reason.
5. Do not leave claimed mentions unresolved between loops; unresolved claims may be re-delivered until lease expiry.

Suggested interval: every 30 seconds (or use the `pollIntervalSeconds` from API responses).

