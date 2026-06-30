import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef((/** @type {any} */ { className = "", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-large border border-m3-outline-variant bg-m3-surface text-m3-on-surface shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef((/** @type {any} */ { className = "", ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1 p-6 pb-4", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef((/** @type {any} */ { className = "", ...props }, ref) => (
  <div
    ref={ref}
    className={cn("m3-title-large font-semibold", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef((/** @type {any} */ { className = "", ...props }, ref) => (
  <div
    ref={ref}
    className={cn("m3-body-small text-m3-on-surface-variant", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef((/** @type {any} */ { className = "", ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef((/** @type {any} */ { className = "", ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
