import { cn } from "@/lib/utils"

interface StatusDotProps {
  connected: boolean
  className?: string
}

export function StatusDot({ connected, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        "h-2.5 w-2.5 rounded-full",
        connected ? "bg-green-500" : "bg-red-500",
        className
      )}
    />
  )
}
