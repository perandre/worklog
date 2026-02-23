"use client"

import { signIn } from "next-auth/react"
import { Calendar, Mail, FileText, MessageSquare, Github } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"

const sources = [
  { icon: Calendar, color: "#4285F4", label: "Calendar", size: 52, x: -60, y: -50 },
  { icon: Mail, color: "#EA4335", label: "Gmail", size: 44, x: 55, y: -35 },
  { icon: FileText, color: "#34A853", label: "Docs", size: 40, x: -45, y: 40 },
  { icon: MessageSquare, color: "#4A154B", label: "Slack", size: 46, x: 60, y: 45 },
  { icon: Github, color: "#333", label: "GitHub", size: 36, x: 0, y: -70 },
]

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="welcome-fade-in flex flex-col items-center gap-10">
          {/* Floating icon cluster */}
          <div className="relative w-64 h-64 flex items-center justify-center">
            {/* Center dot — subtle anchor */}
            <div className="absolute w-2 h-2 rounded-full bg-muted" />

            {sources.map((source, i) => {
              const Icon = source.icon
              return (
                <div
                  key={source.label}
                  className={`welcome-float welcome-stagger-${i + 1} absolute rounded-full flex items-center justify-center shadow-lg`}
                  style={{
                    width: source.size,
                    height: source.size,
                    backgroundColor: source.color,
                    left: `calc(50% + ${source.x}px - ${source.size / 2}px)`,
                    top: `calc(50% + ${source.y}px - ${source.size / 2}px)`,
                  }}
                >
                  <Icon
                    className="text-white"
                    style={{
                      width: source.size * 0.45,
                      height: source.size * 0.45,
                    }}
                    strokeWidth={1.75}
                  />
                </div>
              )
            })}
          </div>

          {/* Tagline */}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Your day, at a glance
          </h1>

          {/* Sign in */}
          <div className="flex flex-col items-center gap-3">
            <Button onClick={() => signIn("google")} size="lg" className="px-8 text-base">
              Sign in with Google
            </Button>
            <p className="text-xs text-muted-foreground">
              Connect Google to get started
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
