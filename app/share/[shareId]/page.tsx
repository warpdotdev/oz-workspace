import { SharedRoom } from "@/components/shared-room"

export default async function ShareRoomPage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params
  return <SharedRoom shareId={shareId} />
}

