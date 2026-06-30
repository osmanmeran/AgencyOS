import * as React from "react"

import { cn } from "@/lib/utils"

const Table = React.forwardRef((/** @type {any} */ { className = "", ...props }, ref) => (
  <div className="relative w-full overflow-auto rounded-large border border-m3-outline-variant">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef((/** @type {any} */ { className = "", ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b border-m3-outline-variant bg-m3-surface-container-low", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef((/** @type {any} */ { className = "", ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef((/** @type {any} */ { className = "", ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("border-t border-m3-outline-variant bg-m3-surface-container-low font-medium", className)}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef((/** @type {any} */ { className = "", ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-m3-outline-variant transition-colors hover:bg-m3-secondary-container/30 data-[state=selected]:bg-m3-primary-container/30",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef((/** @type {any} */ { className = "", ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle text-xs font-medium text-m3-on-surface-variant uppercase tracking-wider [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef((/** @type {any} */ { className = "", ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-4 align-middle text-m3-on-surface [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef((/** @type {any} */ { className = "", ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-m3-on-surface-variant", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
