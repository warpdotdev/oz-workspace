export interface AgentCallbackPayloadV1 {
  version: 1
  roomId: string
  agentId: string
  userId: string | null
  message: string | null
}

export function encodeAgentCallbackPayload(payload: AgentCallbackPayloadV1): string {
  return JSON.stringify(payload)
}

export function tryDecodeAgentCallbackPayload(raw: string): AgentCallbackPayloadV1 | null {
  if (typeof raw !== "string") return null
  // Fast path: most plain-text responses won't be JSON.
  if (!raw.startsWith("{")) return null

  try {
    const parsed = JSON.parse(raw) as Partial<AgentCallbackPayloadV1>
    if (parsed?.version !== 1) return null
    if (typeof parsed.roomId !== "string" || parsed.roomId.length === 0) return null
    if (typeof parsed.agentId !== "string" || parsed.agentId.length === 0) return null
    if (!(typeof parsed.userId === "string" || parsed.userId === null || parsed.userId === undefined)) return null
    if (!(typeof parsed.message === "string" || parsed.message === null || parsed.message === undefined)) return null

    return {
      version: 1,
      roomId: parsed.roomId,
      agentId: parsed.agentId,
      userId: parsed.userId ?? null,
      message: parsed.message ?? null,
    }
  } catch {
    return null
  }
}

