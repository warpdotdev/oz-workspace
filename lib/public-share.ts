import { prisma } from "@/lib/prisma"

export async function getSharedRoomByPublicShareId(publicShareId: string) {
  if (!publicShareId) return null
  return prisma.room.findUnique({
    where: { publicShareId },
    select: { id: true, name: true, description: true, createdAt: true },
  })
}

