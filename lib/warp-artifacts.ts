import { prisma } from "@/lib/prisma"
import { eventBroadcaster } from "@/lib/event-broadcaster"
import type { WarpArtifact } from "@/lib/oz-client"

const ARTIFACT_TYPE_MAP: Record<string, string> = {
  PLAN: "plan",
  PULL_REQUEST: "pr",
}

function normalizeArtifactType(type: string) {
  return ARTIFACT_TYPE_MAP[type] ?? type.toLowerCase()
}

function getArtifactTitle(a: WarpArtifact) {
  const data = (a as { data?: WarpArtifact["data"] | null }).data ?? {}
  return data.title ?? data.branch ?? a.artifact_type
}

function getArtifactUrl(a: WarpArtifact) {
  const data = (a as { data?: WarpArtifact["data"] | null }).data ?? {}
  return data.url ?? null
}

function getArtifactContent(a: WarpArtifact) {
  const data = (a as { data?: WarpArtifact["data"] | null }).data ?? {}
  if (data.document_uid) return `document:${data.document_uid}`
  return ""
}

export async function saveWarpArtifacts(
  artifacts: WarpArtifact[],
  ctx: { roomId: string; agentId: string; userId: string | null },
) {
  for (const a of artifacts) {
    const rawType = typeof a.artifact_type === "string" && a.artifact_type.length > 0 ? a.artifact_type : "unknown"
    const type = normalizeArtifactType(rawType)
    const title = getArtifactTitle(a) ?? rawType
    const url = getArtifactUrl(a)
    const content = getArtifactContent(a)

    try {
      // Best-effort de-dupe (callbacks and long-pollers can race).
      const existing = await prisma.artifact.findFirst({
        where: {
          roomId: ctx.roomId,
          type,
          title,
          url,
          content,
          createdBy: ctx.agentId,
        },
        select: { id: true },
      })
      if (existing) continue

      const artifact = await prisma.artifact.create({
        data: {
          type,
          title,
          content,
          url,
          roomId: ctx.roomId,
          createdBy: ctx.agentId,
          userId: ctx.userId,
        },
        include: {
          agent: {
            select: { id: true, name: true, color: true, icon: true, status: true, activeRoomId: true },
          },
        },
      })

      console.log(`[warp-artifacts] Saved artifact: ${type} — ${title} (id: ${artifact.id})`)

      eventBroadcaster.broadcast({
        type: "artifact",
        roomId: ctx.roomId,
        data: artifact,
      })
    } catch (err) {
      console.error("[warp-artifacts] Failed to save artifact:", err)
    }
  }
}

