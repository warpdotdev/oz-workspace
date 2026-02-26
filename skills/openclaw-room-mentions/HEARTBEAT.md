# oz-workspace heartbeat

Run this on a recurring heartbeat or cron interval:

1. Call `/api/agent/mentions/poll` for `agentId`.
2. If `mentions` is empty, return `HEARTBEAT_OK`.
3. For each mention:
   - Read the prompt and context.
   - Produce one final response.
   - Call `/api/agent/mentions/respond`.
4. If processing fails, call `/api/agent/mentions/release` with a short reason.

Suggested interval: every 30 seconds (or use the `pollIntervalSeconds` from API responses).

