import { cn } from "@/lib/utils"

function Skeleton({ className = "", ...props }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-medium bg-gradient-to-r from-m3-surface-container-high via-m3-surface-container-highest to-m3-surface-container-high bg-[length:400%_100%] animate-shimmer",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
