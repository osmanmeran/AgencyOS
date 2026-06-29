import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-m3-secondary-container data-[state=on]:text-m3-secondary-container-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 m3-state-hover",
  {
    variants: {
      variant: {
        default: "bg-transparent text-m3-on-surface-variant hover:text-m3-on-surface",
        outline:
          "border border-m3-outline bg-transparent text-m3-on-surface-variant hover:bg-m3-secondary-container hover:text-m3-on-surface",
      },
      size: {
        default: "h-9 px-3 min-w-9",
        sm: "h-8 px-2 min-w-8",
        lg: "h-10 px-4 min-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Toggle = React.forwardRef(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
))

Toggle.displayName = TogglePrimitive.Root.displayName

export { Toggle, toggleVariants }
