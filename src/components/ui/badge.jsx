import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-m3-primary-container text-m3-primary-container-foreground",
        secondary:
          "bg-m3-secondary-container text-m3-secondary-container-foreground",
        destructive:
          "bg-m3-error-container text-m3-error-container-foreground",
        outline:
          "border border-m3-outline text-m3-on-surface-variant",
        success:
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        warning:
          "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className = "", variant = "default", ...props }) {
  return <div className={cn(badgeVariants({ variant: /** @type {any} */ (variant) }), className)} {...props} />
}

export { Badge, badgeVariants }
