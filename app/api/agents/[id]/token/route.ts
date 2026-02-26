import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  getAuthenticatedWorkspaceContext,
  AuthError,
  ForbiddenError,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth-helper"
import {
  generateAgentAccessToken,
  getTokenPreview,
  hashAgentAccessToken,
} from "@/lib/openclaw"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await getAuthenticatedWorkspaceContext()
    const { id } = await params

    const existing = await prisma.agent.findUnique({
      where: { id, workspaceId },
      select: { id: true, harness: true },
    })

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (existing.harness !== "openclaw") {
      return NextResponse.json({ error: "Token auth is only available for OpenClaw agents" }, { status: 400 })
    }

    const token = generateAgentAccessToken()
    const tokenHash = hashAgentAccessToken(token)
    const tokenPreview = getTokenPreview(token)

    await prisma.agent.update({
      where: { id },
      data: {
        agentTokenHash: tokenHash,
        agentTokenPreview: tokenPreview,
      },
    })

    return NextResponse.json({
      token,
      tokenPreview,
    })
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    if (error instanceof ForbiddenError) return forbiddenResponse(error.message)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

