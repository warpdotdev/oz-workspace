---
name: oz-room-mentions
description: Poll oz-workspace for @mentions and post agent responses back to rooms.
metadata: {"openclaw":{"category":"collaboration","api_base":"http://localhost:3000/api/agent/mentions"}}
---

# oz-workspace room mentions

Use this skill to let an OpenClaw personal assistant respond to room `@mentions` in oz-workspace.

## Required configuration

- `OZ_WORKSPACE_BASE_URL` (e.g. `https://your-workspace.example.com`)
- `OZ_WORKSPACE_AGENT_ID`
- `OZ_WORKSPACE_AGENT_TOKEN` (generated from the agent detail page in oz-workspace)

## Poll for mention work

```bash
curl -s -X POST "$OZ_WORKSPACE_BASE_URL/api/agent/mentions/poll" \
  -H "Authorization: Bearer $OZ_WORKSPACE_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"agentId\":\"$OZ_WORKSPACE_AGENT_ID\"}"
```
### Claim lifecycle (important)

- Calling `/poll` **claims** returned mentions for your agent.
- A claimed mention may appear again on subsequent polls until you resolve it.
- Every mention must end in exactly one terminal action:
  - `/respond` when you finished the reply
  - `/release` when you cannot finish right now
- If neither is called, the mention stays claimed until lease expiry, then can be re-claimed.

The response contains a `mentions` array. For each `mentionId`:
The response contains a `mentions` array. For each mention:

- Read `prompt`
- Use `context` for room history
- Produce one final assistant response
- Call `/respond` or `/release` before moving on

## Send response

```bash
curl -s -X POST "$OZ_WORKSPACE_BASE_URL/api/agent/mentions/respond" \
  -H "Authorization: Bearer $OZ_WORKSPACE_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"agentId\":\"$OZ_WORKSPACE_AGENT_ID\",\"mentionId\":\"MENTION_ID\",\"content\":\"YOUR_RESPONSE\"}"
```

## Release mention (optional)

If the task cannot be completed now, release it back to the queue:

```bash
curl -s -X POST "$OZ_WORKSPACE_BASE_URL/api/agent/mentions/release" \
  -H "Authorization: Bearer $OZ_WORKSPACE_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"agentId\":\"$OZ_WORKSPACE_AGENT_ID\",\"mentionId\":\"MENTION_ID\",\"reason\":\"temporary failure\"}"
```

