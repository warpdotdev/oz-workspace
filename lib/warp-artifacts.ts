import { prisma } from "@/lib/prisma"
import { eventBroadcaster } from "@/lib/event-broadcaster"
import type { ArtifactItem } from "@/lib/oz-client"

const ARTIFACT_TYPE_MAP: Record<string, string> = {
  PLAN: "plan",
  PULL_REQUEST: "pr",
}

function normalizeArtifactType(type: string) {
  return ARTIFACT_TYPE_MAP[type] ?? type.toLowerCase()
}

function getArtifactTitle(a: ArtifactItem) {
  switch (a.artifact_type) {
    case "PLAN":
      return a.data.title ?? a.artifact_type
    case "PULL_REQUEST":
      return a.data.branch ?? a.artifact_type
  }
}

function slugify(text: string) {
  return text.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-")
}

function getArtifactUrl(a: ArtifactItem) {
  if (a.artifact_type === "PULL_REQUEST") return a.data.url
  if (a.artifact_type === "PLAN" && a.data.notebook_uid) {
    const base = (process.env.WARP_API_URL || "https://app.warp.dev").replace(/\/+$/, "")
    const slug = a.data.title ? `${slugify(a.data.title)}-${a.data.notebook_uid}` : a.data.notebook_uid
    return `${base}/drive/notebook/${slug}`
  }
  return null
}

function getArtifactContent(a: ArtifactItem) {
  if (a.artifact_type === "PLAN") return `document:${a.data.document_uid}`
  return ""
}

export async function saveWarpArtifacts(
  artifacts: ArtifactItem[],
  ctx: { roomId: string; agentId: string; userId: string | null },
) {
  for (const a of artifacts) {
    const type = normalizeArtifactType(a.artifact_type)
    const title = getArtifactTitle(a)
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

