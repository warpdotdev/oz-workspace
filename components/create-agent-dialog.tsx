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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { IconPicker } from "@/components/icon-picker"
import { useAgentStore } from "@/lib/stores"

const AGENT_COLORS = [
  "#3B82F6", "#F59E0B", "#8B5CF6", "#EC4899",
  "#10B981", "#EF4444", "#06B6D4", "#F97316",
]

export function CreateAgentDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { createAgent } = useAgentStore()
  const [name, setName] = React.useState("")
  const [environmentId, setEnvironmentId] = React.useState("")
  const [systemPrompt, setSystemPrompt] = React.useState("")
  const [color, setColor] = React.useState(AGENT_COLORS[0])
  const [icon, setIcon] = React.useState("robot")
  const [loading, setLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      await createAgent({
        name: name.trim(),
        environmentId: environmentId.trim(),
        harness: "oz",
        systemPrompt: systemPrompt.trim(),
        color,
        icon,
      })
      onOpenChange(false)
      setName("")
      setEnvironmentId("")
      setSystemPrompt("")
      setColor(AGENT_COLORS[0])
      setIcon("robot")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Agent</DialogTitle>
          <DialogDescription>
            Configure a new agent with a repository, harness, and system prompt.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="agent-name">Name</FieldLabel>
                <Input
                  id="agent-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. backend-lead"
                  required
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
                        color === c ? "border-foreground" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </Field>
            </div>
            <Field>
              <FieldLabel>Icon</FieldLabel>
              <IconPicker value={icon} onChange={setIcon} />
            </Field>
            <Field>
              <FieldLabel htmlFor="agent-env">Environment ID</FieldLabel>
              <Input
                id="agent-env"
                value={environmentId}
                onChange={(e) => setEnvironmentId(e.target.value)}
                placeholder="e.g. your-environment-id"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="agent-prompt">System Prompt</FieldLabel>
              <Textarea
                id="agent-prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a backend engineering agent..."
                rows={3}
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create Agent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
