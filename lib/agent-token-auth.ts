import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAgentAccessToken } from "@/lib/openclaw"

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization")
  if (!header) return null
  const [scheme, token] = header.split(" ")
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null
  return token.trim()
}

export async function authenticateOpenClawAgent(
  request: Request,
  agentId: string
): Promise<{ agent: { id: string; harness: string } } | { error: NextResponse }> {
  const token = extractBearerToken(request)
  if (!token) {
    return { error: NextResponse.json({ error: "Missing bearer token" }, { status: 401 }) }
  }

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, harness: true, agentTokenHash: true },
  })

  if (!agent || agent.harness !== "openclaw") {
    return { error: NextResponse.json({ error: "OpenClaw agent not found" }, { status: 404 }) }
  }

  if (!verifyAgentAccessToken(token, agent.agentTokenHash)) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  return { agent: { id: agent.id, harness: agent.harness } }
}

