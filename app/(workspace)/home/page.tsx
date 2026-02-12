"use client"

import * as React from "react"
import Link from "next/link"
import { KeyIcon, RobotIcon, HashIcon, AtIcon } from "@phosphor-icons/react"
import { CreateRoomDialog } from "@/components/create-room-dialog"

const steps = [
  {
    icon: KeyIcon,
    title: "Enter your Warp API Key",
    description:
      "Go to Settings and paste your Warp API key. This is required to run agents.",
    link: { href: "/settings", label: "Open Settings" },
  },
  {
    icon: RobotIcon,
    title: "Create Agents",
    description:
      "Use the + button next to Agents in the sidebar to create your first agent. Give it a name, system prompt, and environment ID.",
    link: { href: "/agents", label: "Manage Agents" },
  },
  {
    icon: HashIcon,
    title: "Create a Room",
    description:
      "Rooms organize work around a project. Use the + button next to Rooms in the sidebar. Set a description to define what the project is about — agents will see this as context.",
    action: "create-room" as const,
  },
  {
    icon: AtIcon,
    title: "@mention an Agent",
    description:
      "In a room's chat, type @AgentName to kick off an agent. The agent will read the room context, chat history, and your message, then get to work.",
  },
]

export default function HomePage() {
  const [roomDialogOpen, setRoomDialogOpen] = React.useState(false)

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 items-center border-b px-4">
        <h1 className="text-sm font-semibold">Home</h1>
      </header>
      <div className="flex-1 overflow-auto px-6">
        <div className="mx-auto max-w-lg" style={{ paddingTop: "4rem", paddingBottom: "4rem" }}>
          <h2 className="text-lg font-semibold">Welcome to Oz Workspace</h2>
          <p className="text-sm text-muted-foreground leading-relaxed" style={{ marginTop: "0.5rem" }}>
            Oz is a multi-agent chat room where you can create AI agents,
            assign them to project rooms, and collaborate through conversation.
          </p>

          <h3 className="text-sm font-semibold" style={{ marginTop: "3rem", marginBottom: "1.5rem" }}>Getting Started</h3>
          <ol style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    {i + 1}
                  </span>
                  <div className="space-y-1 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <step.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{step.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                    {step.link && (
                      <Link
                        href={step.link.href}
                        className="inline-block text-xs text-primary hover:underline"
                      >
                        {step.link.label} →
                      </Link>
                    )}
                    {"action" in step && step.action === "create-room" && (
                      <button
                        type="button"
                        onClick={() => setRoomDialogOpen(true)}
                        className="inline-block text-xs text-primary hover:underline"
                      >
                        Create Room →
                      </button>
                    )}
                  </div>
                </li>
              ))}
          </ol>
        </div>
      </div>
      <CreateRoomDialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen} />
    </div>
  )
}
