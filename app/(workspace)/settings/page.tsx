"use client"

import * as React from "react"
import { EyeIcon, EyeSlashIcon, FloppyDiskIcon } from "@phosphor-icons/react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useSettingsStore } from "@/lib/stores"

export default function SettingsPage() {
  const { settings, fetchSettings, updateSetting } = useSettingsStore()
  const [apiKey, setApiKey] = React.useState("")
  const [showKey, setShowKey] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)

  React.useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  React.useEffect(() => {
    if (settings.warp_api_key !== undefined) {
      setApiKey(settings.warp_api_key)
    }
  }, [settings.warp_api_key])

  const handleSave = async () => {
    setSaving(true)
    await updateSetting("warp_api_key", apiKey)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 items-center border-b px-4">
        <h1 className="text-sm font-semibold">Settings</h1>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-md space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="warp-api-key">
              Warp API Key
            </label>
            <p className="text-xs text-muted-foreground">
              Used to authenticate with the Warp API for running agents.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="warp-api-key"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Warp API key"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? (
                    <EyeSlashIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
              <Button onClick={handleSave} disabled={saving}>
                <FloppyDiskIcon className="h-4 w-4" />
                {saved ? "Saved" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
