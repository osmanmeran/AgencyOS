import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 m3-state-hover select-none",
  {
    variants: {
      variant: {
        default:
          "bg-m3-primary text-m3-primary-foreground shadow-sm hover:shadow-md active:shadow-sm",
        destructive:
          "bg-m3-error text-m3-error-foreground shadow-sm hover:shadow-md active:shadow-sm",
        outline:
          "border border-m3-outline bg-transparent text-m3-on-surface hover:bg-m3-secondary-container active:bg-m3-secondary-container",
        secondary:
          "bg-m3-secondary-container text-m3-secondary-container-foreground shadow-sm hover:shadow-md active:shadow-sm",
        ghost: "text-m3-on-surface hover:bg-m3-secondary-container active:bg-m3-secondary-container",
        link: "text-m3-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-6 py-2 rounded-full",
        sm: "h-8 rounded-full px-4 text-xs",
        lg: "h-12 rounded-full px-8 text-base",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
