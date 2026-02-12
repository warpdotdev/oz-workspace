"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import {
  TrayIcon,
  HashIcon,
  PlusIcon,
  GearIcon,
  HouseIcon,
  SignOutIcon,
} from "@phosphor-icons/react"
import { AgentIcon } from "@/components/agent-icon"
import { OzLogo } from "@/components/oz-logo"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useRoomStore } from "@/lib/stores"
import { useAgentStore } from "@/lib/stores"
import { useNotificationStore } from "@/lib/stores"
import { CreateRoomDialog } from "@/components/create-room-dialog"
import { CreateAgentDialog } from "@/components/create-agent-dialog"

export function AppSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { rooms, fetchRooms } = useRoomStore()
  const { agents, fetchAgents } = useAgentStore()
  const { unreadCount, fetchNotifications } = useNotificationStore()
  const [roomDialogOpen, setRoomDialogOpen] = React.useState(false)
  const [agentDialogOpen, setAgentDialogOpen] = React.useState(false)

  React.useEffect(() => {
    fetchRooms()
    fetchAgents()
    fetchNotifications()
  }, [fetchRooms, fetchAgents, fetchNotifications])

  return (
    <>
      <Sidebar>
        <SidebarHeader className="px-3 py-3">
          <div className="flex items-center gap-2">
            <OzLogo />
            <span className="text-sm font-semibold tracking-tight">Oz Workspace</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {/* Home, Settings & Inbox */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/home"}>
                    <Link href="/home">
                      <HouseIcon />
                      <span>Home</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/settings"}>
                    <Link href="/settings">
                      <GearIcon />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/inbox"}>
                    <Link href="/inbox">
                    <TrayIcon />
                      <span>Inbox</span>
                    </Link>
                  </SidebarMenuButton>
                  {unreadCount > 0 && (
                    <SidebarMenuBadge>{unreadCount}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Rooms */}
          <SidebarGroup>
            <SidebarGroupLabel>Rooms</SidebarGroupLabel>
            <SidebarGroupAction onClick={() => setRoomDialogOpen(true)} title="Create Room">
              <PlusIcon />
              <span className="sr-only">Create Room</span>
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {rooms.map((room) => (
                  <SidebarMenuItem key={room.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/room/${room.id}`}
                    >
                      <Link href={`/room/${room.id}`}>
                        <HashIcon />
                        <span>{room.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Agents */}
          <SidebarGroup>
            <SidebarGroupLabel>Agents</SidebarGroupLabel>
            <SidebarGroupAction onClick={() => setAgentDialogOpen(true)} title="New Agent">
              <PlusIcon />
              <span className="sr-only">New Agent</span>
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {agents.map((agent) => (
                  <SidebarMenuItem key={agent.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/agents/${agent.id}`}
                    >
                    <Link href={`/agents/${agent.id}`}>
                        <AgentIcon icon={agent.icon} />
                        <span>{agent.name}</span>
                      </Link>
                    </SidebarMenuButton>
                    <SidebarMenuBadge>
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: agent.color }}
                      />
                    </SidebarMenuBadge>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{session?.user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{session?.user?.email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Sign out"
            >
              <SignOutIcon className="h-4 w-4" />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <CreateRoomDialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen} />
      <CreateAgentDialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen} />
    </>
  )
}
