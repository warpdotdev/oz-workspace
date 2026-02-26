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

The response contains a `mentions` array. For each mention:

- Read `prompt`
- Use `context` for room history
- Produce one final assistant response

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

