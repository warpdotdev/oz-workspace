import { NextResponse } from "next/server"

/**
 * Validates the agent API key from request headers.
 * Returns null if valid, or an error response if invalid.
 */
export function validateAgentApiKey(request: Request): NextResponse | null {
  const apiKey = request.headers.get("X-Agent-Key")
  const expectedKey = process.env.AGENT_API_KEY

  if (!expectedKey) {
    console.error("[agent-auth] AGENT_API_KEY environment variable not set")
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    )
  }

  if (!apiKey || apiKey !== expectedKey) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  return null
}
