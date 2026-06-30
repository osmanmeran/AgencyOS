import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-medium border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-m3-on-surface-variant [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-m3-surface-container-low text-m3-on-surface border-m3-outline-variant",
        destructive:
          "border-m3-error/50 text-m3-error dark:border-m3-error [&>svg]:text-m3-error bg-m3-error-container/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef((/** @type {any} */ { className = "", variant = "default", ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef((/** @type {any} */ { className = "", ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("m3-label-large mb-1", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef((/** @type {any} */ { className = "", ...props }, ref) => (
  <div
    ref={ref}
    className={cn("m3-body-small [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
