"use client"

import * as React from "react"
import { UsersIcon, PlusIcon, CheckIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { CreateAgentDialog } from "@/components/create-agent-dialog"
import { useAgentStore, useRoomStore } from "@/lib/stores"

export function AddAgentsBanner({ roomId }: { roomId: string }) {
  const { agents } = useAgentStore()
  const { updateRoomAgents } = useRoomStore()
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set())
  const [saving, setSaving] = React.useState(false)
  const [createAgentOpen, setCreateAgentOpen] = React.useState(false)

  const toggleAgent = (id: string) => {
    setPendingIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAdd = async () => {
    if (pendingIds.size === 0) return
    setSaving(true)
    try {
      await updateRoomAgents(roomId, Array.from(pendingIds))
    } finally {
      setSaving(false)
    }
  }

  if (agents.length === 0) {
    return (
      <>
        <div className="mx-4 my-3 rounded-lg border border-dashed border-yellow-500/40 bg-yellow-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-yellow-400">
            <UsersIcon className="h-4 w-4" />
            No agents in this room
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setCreateAgentOpen(true)}
            >
              Create an agent
            </button>
            {" "}first, then add it to this room to start collaborating.
          </p>
        </div>
        <CreateAgentDialog open={createAgentOpen} onOpenChange={setCreateAgentOpen} />
      </>
    )
  }

  const hasSelection = pendingIds.size > 0

  return (
    <div className="mx-4 my-3 rounded-lg border border-dashed border-yellow-500/40 bg-yellow-500/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-yellow-400">
        <UsersIcon className="h-4 w-4 shrink-0" />
        No agents in this room
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Add agents so they can respond to your messages. Once added, @mention them in a message to invoke them.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {agents.map((agent) => {
          const isSelected = pendingIds.has(agent.id)
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => toggleAgent(agent.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: agent.color }}
              />
              {agent.name}
              {isSelected ? (
                <CheckIcon className="h-3 w-3" />
              ) : (
                <PlusIcon className="h-3 w-3" />
              )}
            </button>
          )
        })}
        <Button
          size="sm"
          className="ml-auto h-7 text-xs"
          onClick={handleAdd}
          disabled={!hasSelection || saving}
        >
          {saving
            ? "Adding..."
            : hasSelection
              ? `Add ${pendingIds.size} agent${pendingIds.size > 1 ? "s" : ""}`
              : "Add agents"}
        </Button>
      </div>
    </div>
  )
}
