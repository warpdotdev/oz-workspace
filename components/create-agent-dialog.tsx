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
import type { HarnessType } from "@/lib/types"

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
  const [harness, setHarness] = React.useState<HarnessType>("oz")
  const [openclawConfig, setOpenclawConfig] = React.useState({
    pollIntervalSeconds: 30,
    maxMentionsPerPoll: 5,
    contextMessageCount: 20,
    leaseSeconds: 120,
  })
  const [color, setColor] = React.useState(AGENT_COLORS[0])
  const [icon, setIcon] = React.useState("robot")
  const [loading, setLoading] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      await createAgent({
        name: name.trim(),
        environmentId: harness === "oz" ? environmentId.trim() : "",
        harness,
        systemPrompt: harness === "oz" ? systemPrompt.trim() : "",
        openclawConfig,
        color,
        icon,
      })
      onOpenChange(false)
      setName("")
      setEnvironmentId("")
      setSystemPrompt("")
      setHarness("oz")
      setOpenclawConfig({
        pollIntervalSeconds: 30,
        maxMentionsPerPoll: 5,
        contextMessageCount: 20,
        leaseSeconds: 120,
      })
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
            Create an Oz or OpenClaw agent to participate in room mentions.
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
              <FieldLabel>Harness</FieldLabel>
              <div className="inline-flex rounded-md border p-1">
                <Button
                  type="button"
                  variant={harness === "oz" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setHarness("oz")}
                >
                  Oz
                </Button>
                <Button
                  type="button"
                  variant={harness === "openclaw" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setHarness("openclaw")}
                >
                  OpenClaw
                </Button>
              </div>
            </Field>
            {harness === "oz" ? (
              <>
                <Field>
                  <FieldLabel htmlFor="agent-env">Environment ID</FieldLabel>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>To create an environment:</p>
                    <ol className="list-decimal ml-4 space-y-0.5">
                      <li>Clone the <a href="https://github.com/warpdotdev/oz_workspace_agent" target="_blank" rel="noopener noreferrer" className="underline text-foreground">oz_workspace_agent</a> repository.</li>
                      <li>Visit <a href="https://oz.warp.dev/environments" target="_blank" rel="noopener noreferrer" className="underline text-foreground">oz.warp.dev/environments</a>, auth with your GitHub account, and add the cloned repo to a new environment.</li>
                      <li>Enter the environment ID below.</li>
                    </ol>
                  </div>
                  <div className="rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-500">Tip</span>
                        <p>Copy instructions into Warp to get Oz to set up your env</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            "clone this repository to my github account https://github.com/warpdotdev/oz_workspace_agent and create an oz environment using it"
                          )
                          setCopied(true)
                          setTimeout(() => setCopied(false), 2000)
                        }}
                      >
                        {copied ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                  </div>
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
              </>
            ) : (
              <Field>
                <FieldLabel>OpenClaw mention settings</FieldLabel>
                <p className="text-xs text-muted-foreground">
                  After creation, open this agent and generate an access token to install in your OpenClaw skill.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label htmlFor="openclaw-poll-interval" className="text-xs text-muted-foreground">
                      Poll interval (seconds)
                    </label>
                    <p className="text-[10px] leading-tight text-muted-foreground">
                      How often OpenClaw checks for new queued mentions.
                    </p>
                    <Input
                      id="openclaw-poll-interval"
                      type="number"
                      min={5}
                      max={300}
                      value={openclawConfig.pollIntervalSeconds}
                      onChange={(e) =>
                        setOpenclawConfig((prev) => ({
                          ...prev,
                          pollIntervalSeconds: Number(e.target.value || 30),
                        }))
                      }
                      placeholder="30"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="openclaw-max-mentions" className="text-xs text-muted-foreground">
                      Mentions per poll
                    </label>
                    <p className="text-[10px] leading-tight text-muted-foreground">
                      Max queued mentions returned by each poll request.
                    </p>
                    <Input
                      id="openclaw-max-mentions"
                      type="number"
                      min={1}
                      max={20}
                      value={openclawConfig.maxMentionsPerPoll}
                      onChange={(e) =>
                        setOpenclawConfig((prev) => ({
                          ...prev,
                          maxMentionsPerPoll: Number(e.target.value || 5),
                        }))
                      }
                      placeholder="5"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="openclaw-context-count" className="text-xs text-muted-foreground">
                      Context message count
                    </label>
                    <p className="text-[10px] leading-tight text-muted-foreground">
                      Recent room messages included with each mention payload.
                    </p>
                    <Input
                      id="openclaw-context-count"
                      type="number"
                      min={5}
                      max={100}
                      value={openclawConfig.contextMessageCount}
                      onChange={(e) =>
                        setOpenclawConfig((prev) => ({
                          ...prev,
                          contextMessageCount: Number(e.target.value || 20),
                        }))
                      }
                      placeholder="20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="openclaw-lease-seconds" className="text-xs text-muted-foreground">
                      Lease duration (seconds)
                    </label>
                    <p className="text-[10px] leading-tight text-muted-foreground">
                      How long a claimed mention stays reserved before retry.
                    </p>
                    <Input
                      id="openclaw-lease-seconds"
                      type="number"
                      min={30}
                      max={900}
                      value={openclawConfig.leaseSeconds}
                      onChange={(e) =>
                        setOpenclawConfig((prev) => ({
                          ...prev,
                          leaseSeconds: Number(e.target.value || 120),
                        }))
                      }
                      placeholder="120"
                    />
                  </div>
                </div>
              </Field>
            )}
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
