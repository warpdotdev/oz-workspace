"use client"

import * as React from "react"
import Link from "next/link"
import { CheckIcon, TrashIcon } from "@phosphor-icons/react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useNotificationStore } from "@/lib/stores"

export default function InboxPage() {
  const { notifications, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } =
    useNotificationStore()

  React.useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const unread = notifications.filter((n) => !n.read)

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 items-center justify-between border-b px-4">
        <h1 className="text-sm font-semibold">Inbox</h1>
        {unread.length > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllAsRead}>
            <CheckIcon className="mr-1 h-3.5 w-3.5" />
            Mark all read
          </Button>
        )}
      </header>
      <ScrollArea className="flex-1 min-h-0">
        {notifications.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No notifications yet.
          </div>
        ) : (
          <div className="py-2">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors ${
                  !notif.read ? "bg-muted/30" : ""
                }`}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback
                    style={{ backgroundColor: notif.agent?.color ?? "#3B82F6" }}
                    className="text-white text-xs"
                  >
                    {notif.agent?.name?.[0] ?? "A"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {notif.agent?.name ?? "Agent"}
                    </span>
                    {notif.room && (
                      <Link
                        href={`/room/${notif.roomId}`}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        #{notif.room.name}
                      </Link>
                    )}
                    {!notif.read && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">
                        New
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {notif.message}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {new Date(notif.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!notif.read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => markAsRead(notif.id)}
                    >
                      <CheckIcon className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteNotification(notif.id)}
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
