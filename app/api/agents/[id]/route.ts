import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId, AuthError, unauthorizedResponse } from "@/lib/auth-helper"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId()
    const { id } = await params
    const agent = await prisma.agent.findUnique({ where: { id, userId } })
    if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({
      ...agent,
      skills: JSON.parse(agent.skills),
      mcpServers: JSON.parse(agent.mcpServers),
      scripts: JSON.parse(agent.scripts),
    })
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    throw error
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId()
    const { id } = await params
    const existing = await prisma.agent.findUnique({ where: { id, userId } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = await request.json()
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.color !== undefined) data.color = body.color
    if (body.icon !== undefined) data.icon = body.icon
    if (body.repoUrl !== undefined) data.repoUrl = body.repoUrl
    if (body.harness !== undefined) data.harness = body.harness
    if (body.environmentId !== undefined) data.environmentId = body.environmentId
    if (body.systemPrompt !== undefined) data.systemPrompt = body.systemPrompt
    if (body.skills !== undefined) data.skills = JSON.stringify(body.skills)
    if (body.mcpServers !== undefined) data.mcpServers = JSON.stringify(body.mcpServers)
    if (body.scripts !== undefined) data.scripts = JSON.stringify(body.scripts)
    if (body.status !== undefined) data.status = body.status

    const agent = await prisma.agent.update({ where: { id }, data })
    return NextResponse.json({
      ...agent,
      skills: JSON.parse(agent.skills),
      mcpServers: JSON.parse(agent.mcpServers),
      scripts: JSON.parse(agent.scripts),
    })
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    throw error
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId()
    const { id } = await params
    const existing = await prisma.agent.findUnique({ where: { id, userId } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await prisma.agent.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse()
    throw error
  }
}
