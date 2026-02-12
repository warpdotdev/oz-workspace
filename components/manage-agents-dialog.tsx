"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useRoomStore, useAgentStore } from "@/lib/stores"

export function ManageAgentsDialog({
  open,
  onOpenChange,
  roomId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  roomId: string
}) {
  const { rooms, updateRoomAgents } = useRoomStore()
  const { agents } = useAgentStore()
  const room = rooms.find((r) => r.id === roomId)

  const [selectedAgentIds, setSelectedAgentIds] = React.useState<string[]>([])
  const [loading, setLoading] = React.useState(false)

  // Sync selected agents when dialog opens or room changes
  React.useEffect(() => {
    if (open && room?.agents) {
      setSelectedAgentIds(room.agents.map((a) => a.id))
    }
  }, [open, room?.agents])

  const toggleAgent = (id: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await updateRoomAgents(roomId, selectedAgentIds)
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Agents</DialogTitle>
          <DialogDescription>
            Select which agents should be part of this room.
          </DialogDescription>
        </DialogHeader>
        {agents.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No agents available. Create an agent first.
          </div>
        ) : (
          <div className="rounded-md border">
            {agents.map((agent) => {
              const isSelected = selectedAgentIds.includes(agent.id)
              return (
                <div
                  key={agent.id}
                  className="flex items-center justify-between px-3 py-2 not-last:border-b"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: agent.color }}
                    />
                    <span className="text-sm">{agent.name}</span>
                  </div>
                  <Button
                    type="button"
                    variant={isSelected ? "outline" : "default"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => toggleAgent(agent.id)}
                  >
                    {isSelected ? "Remove" : "Add"}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
