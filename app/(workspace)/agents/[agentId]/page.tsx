"use client"

import * as React from "react"
import { use } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, TrashIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { ScrollArea } from "@/components/ui/scroll-area"
import { IconPicker } from "@/components/icon-picker"
import { useAgentStore } from "@/lib/stores"
import type { Agent } from "@/lib/types"

const AGENT_COLORS = [
  "#3B82F6", "#F59E0B", "#8B5CF6", "#EC4899",
  "#10B981", "#EF4444", "#06B6D4", "#F97316",
]

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>
}) {
  const { agentId } = use(params)
  const router = useRouter()
  const { updateAgent, deleteAgent } = useAgentStore()
  const [agent, setAgent] = React.useState<Agent | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [dirty, setDirty] = React.useState(false)

  React.useEffect(() => {
    fetch(`/api/agents/${agentId}`)
      .then((r) => r.json())
      .then(setAgent)
  }, [agentId])

  const update = (patch: Partial<Agent>) => {
    if (!agent) return
    setAgent({ ...agent, ...patch })
    setDirty(true)
  }

  const handleSave = async () => {
    if (!agent || !dirty) return
    setSaving(true)
    try {
      const saved = await updateAgent(agentId, agent)
      setAgent(saved)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this agent?")) return
    setDeleting(true)
    try {
      await deleteAgent(agentId)
      router.push("/agents")
    } finally {
      setDeleting(false)
    }
  }

  if (!agent) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 items-center gap-2 border-b px-4">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.push("/agents")}>
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: agent.color }}
          />
          <h1 className="text-sm font-semibold">{agent.name}</h1>
        </div>
        <Button size="sm" disabled={!dirty || saving} onClick={handleSave}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          disabled={deleting}
          onClick={handleDelete}
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      </header>
      <ScrollArea className="flex-1">
        <div className="max-w-2xl mx-auto p-6">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="detail-name">Name</FieldLabel>
                <Input
                  id="detail-name"
                  value={agent.name}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel>Color</FieldLabel>
                <div className="flex gap-1.5">
                  {AGENT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`h-7 w-7 rounded-full border-2 transition-colors ${
                        agent.color === c ? "border-foreground" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => update({ color: c })}
                    />
                  ))}
                </div>
              </Field>
            </div>
            <Field>
              <FieldLabel>Icon</FieldLabel>
              <IconPicker value={agent.icon} onChange={(icon) => update({ icon })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="detail-env">Environment ID</FieldLabel>
              <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-1">
                <p>To create an environment:</p>
                <ol className="list-decimal ml-4 space-y-0.5">
                  <li>Clone the <a href="https://github.com/warpdotdev/oz_workspace_agent" target="_blank" rel="noopener noreferrer" className="underline text-foreground">oz_workspace_agent</a> repository.</li>
                  <li>Visit <a href="https://oz.warp.dev/environments" target="_blank" rel="noopener noreferrer" className="underline text-foreground">oz.warp.dev/environments</a>, auth with your GitHub account, and add the cloned repo to a new environment.</li>
                  <li>Enter the environment ID below.</li>
                </ol>
              </div>
              <Input
                id="detail-env"
                value={agent.environmentId}
                onChange={(e) => update({ environmentId: e.target.value })}
                placeholder="e.g. your-environment-id"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="detail-prompt">System Prompt</FieldLabel>
              <Textarea
                id="detail-prompt"
                value={agent.systemPrompt}
                onChange={(e) => update({ systemPrompt: e.target.value })}
                rows={5}
              />
            </Field>
          </FieldGroup>
        </div>
      </ScrollArea>
    </div>
  )
}
