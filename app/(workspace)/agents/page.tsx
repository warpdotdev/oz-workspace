"use client"

import * as React from "react"
import Link from "next/link"
import { PlusIcon, TrashIcon } from "@phosphor-icons/react"
import { AgentIcon } from "@/components/agent-icon"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAgentStore } from "@/lib/stores"
import { CreateAgentDialog } from "@/components/create-agent-dialog"

export default function AgentsPage() {
  const { agents, fetchAgents, deleteAgent } = useAgentStore()
  const [dialogOpen, setDialogOpen] = React.useState(false)

  React.useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 items-center justify-between border-b px-4">
        <h1 className="text-sm font-semibold">Agents</h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <PlusIcon className="mr-1 h-3.5 w-3.5" />
          New Agent
        </Button>
      </header>
      <ScrollArea className="flex-1">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full"
                    style={{ backgroundColor: agent.color }}
                  >
                    <AgentIcon icon={agent.icon} className="h-3.5 w-3.5 text-white" />
                  </span>
                  <CardTitle className="text-sm">
                    <Link href={`/agents/${agent.id}`} className="hover:underline">
                      {agent.name}
                    </Link>
                  </CardTitle>
                </div>
                <CardDescription className="text-xs truncate" title={agent.environmentId}>
                  {agent.environmentId || "No environment"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <Badge
                  variant={agent.status === "running" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {agent.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteAgent(agent.id)}
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
      <CreateAgentDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
