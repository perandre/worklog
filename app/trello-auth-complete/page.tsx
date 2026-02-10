"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function TrelloAuthCompletePage() {
  const router = useRouter()

  useEffect(() => {
    // Trello sends the token in the URL fragment, e.g. #token=...&...
    if (typeof window === "undefined") return

    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash
    const params = new URLSearchParams(hash)
    const token = params.get("token")

    if (!token) {
      router.replace("/?trello_error=no_token")
      return
    }

    const callbackUrl = `/api/auth/trello/callback?token=${encodeURIComponent(token)}`

    fetch(callbackUrl)
      .then(() => {
        router.replace("/?trello_connected=true")
      })
      .catch(() => {
        router.replace("/?trello_error=store_failed")
      })
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground">Completing Trello connection…</p>
    </div>
  )
}

