"use client"

import * as React from "react"
import { use } from "react"
import { useRouter } from "next/navigation"
import { HashIcon, DotsThreeIcon, UsersIcon, TrashIcon, NotePencilIcon, LinkSimpleIcon, CopyIcon, CheckIcon } from "@phosphor-icons/react"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { ChatStream } from "@/components/chat-stream"
import { ArtifactsPanel } from "@/components/artifacts-panel"
import { KanbanBoard } from "@/components/kanban-board"
import { ManageAgentsDialog } from "@/components/manage-agents-dialog"
import { useRoomStore } from "@/lib/stores"

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params)
  const router = useRouter()
  const { rooms, deleteRoom, updateRoomDescription, refreshRoom } = useRoomStore()
  const room = rooms.find((r) => r.id === roomId)
  const [manageAgentsOpen, setManageAgentsOpen] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [descriptionDialogOpen, setDescriptionDialogOpen] = React.useState(false)
  const [descriptionDraft, setDescriptionDraft] = React.useState("")
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false)
  const [shareBusy, setShareBusy] = React.useState(false)
  const [shareError, setShareError] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const handleDelete = async () => {
    await deleteRoom(roomId)
    router.push("/inbox")
  }

  const openDescriptionDialog = () => {
    setDescriptionDraft(room?.description ?? "")
    setDescriptionDialogOpen(true)
  }

  const handleSaveDescription = async () => {
    await updateRoomDescription(roomId, descriptionDraft)
    setDescriptionDialogOpen(false)
  }
  const publicShareId = room?.publicShareId ?? null
  const publicUrl = mounted && publicShareId
    ? `${window.location.origin}/share/${publicShareId}`
    : ""

  const enableShare = async () => {
    setShareBusy(true)
    setShareError(null)
    try {
      const res = await fetch(`/api/rooms/${roomId}/share`, { method: "POST" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(err.error ?? `Failed to enable sharing (${res.status})`)
      }
      await refreshRoom(roomId)
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Failed to enable sharing")
    } finally {
      setShareBusy(false)
    }
  }

  const disableShare = async () => {
    setShareBusy(true)
    setShareError(null)
    try {
      const res = await fetch(`/api/rooms/${roomId}/share`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(err.error ?? `Failed to disable sharing (${res.status})`)
      }
      setCopied(false)
      await refreshRoom(roomId)
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Failed to disable sharing")
    } finally {
      setShareBusy(false)
    }
  }

  const copyShareUrl = async () => {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      console.error("Failed to copy share URL:", error)
      setShareError("Failed to copy link")
    }
  }

  return (
    <Tabs defaultValue="chat" className="flex h-full flex-col">
      <header className="flex h-12 items-center gap-1.5 border-b px-4">
        <HashIcon className="h-4 w-4 text-muted-foreground" />
        <h1 className="text-sm font-semibold flex-1">{room?.name ?? "Room"}</h1>
        <TabsList>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>
        {mounted && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
              onClick={() => setManageAgentsOpen(true)}
            >
              <div className="flex -space-x-1">
                {(room?.agents ?? []).slice(0, 3).map((agent) => (
                  <span
                    key={agent.id}
                    className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-background"
                    style={{ backgroundColor: agent.color }}
                  />
                ))}
              </div>
              <UsersIcon className="h-3.5 w-3.5" />
              <span>{room?.agents?.length ?? 0}</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <DotsThreeIcon className="h-4 w-4" weight="bold" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="whitespace-nowrap" onClick={openDescriptionDialog}>
                  <NotePencilIcon className="h-4 w-4" />
                  Edit Description
                </DropdownMenuItem>
                <DropdownMenuItem className="whitespace-nowrap" onClick={() => { setShareDialogOpen(true); setShareError(null) }}>
                  <LinkSimpleIcon className="h-4 w-4" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete Room
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </header>
      <Dialog open={descriptionDialogOpen} onOpenChange={setDescriptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Room Description</DialogTitle>
            <DialogDescription>
              Describe the purpose of this room. Agents will see this in their context.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={descriptionDraft}
            onChange={(e) => setDescriptionDraft(e.target.value)}
            placeholder="What is this room for?"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDescriptionDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveDescription}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={shareDialogOpen} onOpenChange={(open) => { setShareDialogOpen(open); if (!open) setCopied(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share room</DialogTitle>
            <DialogDescription>
              Make this room public with a link. Anyone with the link can view chat, tasks, and artifacts (view-only).
            </DialogDescription>
          </DialogHeader>

          {publicShareId ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input value={publicUrl} readOnly />
                <Button variant="outline" onClick={copyShareUrl} disabled={!publicUrl}>
                  {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Stop sharing to revoke this link (it will 404, and re-sharing generates a new link).
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This room is private. Enable sharing to generate a public link.
            </p>
          )}

          {shareError && (
            <p className="text-sm text-destructive">
              {shareError}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)} disabled={shareBusy}>
              Close
            </Button>
            {publicShareId ? (
              <Button variant="destructive" onClick={disableShare} disabled={shareBusy}>
                {shareBusy ? "Stopping..." : "Stop sharing"}
              </Button>
            ) : (
              <Button onClick={enableShare} disabled={shareBusy}>
                {shareBusy ? "Enabling..." : "Create public link"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ManageAgentsDialog
        open={manageAgentsOpen}
        onOpenChange={setManageAgentsOpen}
        roomId={roomId}
      />
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Room</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{room?.name}&quot;? This will permanently
              remove all messages and artifacts in this room.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <TabsContent value="chat" className="flex-1 min-h-0">
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel defaultSize={65} minSize={40}>
            <ChatStream roomId={roomId} />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={35} minSize={20}>
            <div className="flex h-full flex-col">
              <div className="flex h-12 items-center border-b px-4">
                <h2 className="text-sm font-semibold">Artifacts</h2>
              </div>
              <div className="flex-1 min-h-0">
                <ArtifactsPanel roomId={roomId} />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </TabsContent>
      <TabsContent value="tasks" className="flex-1 min-h-0">
        <KanbanBoard roomId={roomId} />
      </TabsContent>
    </Tabs>
  )
}
