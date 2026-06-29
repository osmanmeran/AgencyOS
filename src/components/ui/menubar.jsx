"use client"

import * as React from "react"
import * as MenubarPrimitive from "@radix-ui/react-menubar"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

function MenubarMenu({ ...props }) {
  return <MenubarPrimitive.Menu {...props} />
}

function MenubarGroup({ ...props }) {
  return <MenubarPrimitive.Group {...props} />
}

function MenubarPortal({ ...props }) {
  return <MenubarPrimitive.Portal {...props} />
}

function MenubarRadioGroup({ ...props }) {
  return <MenubarPrimitive.RadioGroup {...props} />
}

function MenubarSub({ ...props }) {
  return <MenubarPrimitive.Sub data-slot="menubar-sub" {...props} />
}

const Menubar = React.forwardRef(({ className, ...props }, ref) => (
  <MenubarPrimitive.Root
    ref={ref}
    className={cn(
      "flex h-9 items-center gap-1 rounded-medium border border-m3-outline-variant bg-m3-surface p-1 shadow-sm",
      className
    )}
    {...props}
  />
))
Menubar.displayName = MenubarPrimitive.Root.displayName

const MenubarTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <MenubarPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-full px-3 py-1 text-sm font-medium outline-none focus:bg-m3-secondary-container focus:text-m3-secondary-container-foreground data-[state=open]:bg-m3-secondary-container data-[state=open]:text-m3-secondary-container-foreground m3-state-hover",
      className
    )}
    {...props}
  />
))
MenubarTrigger.displayName = MenubarPrimitive.Trigger.displayName

const MenubarSubTrigger = React.forwardRef(({ className, inset, children, ...props }, ref) => (
  <MenubarPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-small px-2 py-1.5 text-sm outline-none focus:bg-m3-primary-container focus:text-m3-on-primary-container data-[state=open]:bg-m3-primary-container data-[state=open]:text-m3-on-primary-container m3-state-hover",
      inset && "pl-8",
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </MenubarPrimitive.SubTrigger>
))
MenubarSubTrigger.displayName = MenubarPrimitive.SubTrigger.displayName

const MenubarSubContent = React.forwardRef(({ className, ...props }, ref) => (
  <MenubarPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-medium border border-m3-outline-variant bg-m3-surface p-1 text-m3-on-surface shadow-lg data-[state=open]:animate-m3-fade-in data-[state=closed]:animate-m3-fade-out",
      className
    )}
    {...props}
  />
))
MenubarSubContent.displayName = MenubarPrimitive.SubContent.displayName

const MenubarContent = React.forwardRef(({ className, align = "start", alignOffset = -4, sideOffset = 8, ...props }, ref) => (
  <MenubarPrimitive.Portal>
    <MenubarPrimitive.Content
      ref={ref}
      align={align}
      alignOffset={alignOffset}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[12rem] overflow-hidden rounded-medium border border-m3-outline-variant bg-m3-surface p-1 text-m3-on-surface shadow-lg data-[state=open]:animate-m3-fade-in data-[state=closed]:animate-m3-fade-out",
        className
      )}
      {...props}
    />
  </MenubarPrimitive.Portal>
))
MenubarContent.displayName = MenubarPrimitive.Content.displayName

const MenubarItem = React.forwardRef(({ className, inset, ...props }, ref) => (
  <MenubarPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-small px-2 py-2 text-sm outline-none focus:bg-m3-primary-container focus:text-m3-on-primary-container data-[disabled]:pointer-events-none data-[disabled]:opacity-50 m3-state-hover",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
MenubarItem.displayName = MenubarPrimitive.Item.displayName

const MenubarCheckboxItem = React.forwardRef(({ className, children, checked, ...props }, ref) => (
  <MenubarPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-small py-2 pl-8 pr-2 text-sm outline-none focus:bg-m3-primary-container focus:text-m3-on-primary-container data-[disabled]:pointer-events-none data-[disabled]:opacity-50 m3-state-hover",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}
  </MenubarPrimitive.CheckboxItem>
))
MenubarCheckboxItem.displayName = MenubarPrimitive.CheckboxItem.displayName

const MenubarRadioItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <MenubarPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-small py-2 pl-8 pr-2 text-sm outline-none focus:bg-m3-primary-container focus:text-m3-on-primary-container data-[disabled]:pointer-events-none data-[disabled]:opacity-50 m3-state-hover",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}
  </MenubarPrimitive.RadioItem>
))
MenubarRadioItem.displayName = MenubarPrimitive.RadioItem.displayName

const MenubarLabel = React.forwardRef(({ className, inset, ...props }, ref) => (
  <MenubarPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-xs font-medium text-m3-on-surface-variant uppercase tracking-wider", inset && "pl-8", className)}
    {...props}
  />
))
MenubarLabel.displayName = MenubarPrimitive.Label.displayName

const MenubarSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <MenubarPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-m3-outline-variant", className)}
    {...props}
  />
))
MenubarSeparator.displayName = MenubarPrimitive.Separator.displayName

const MenubarShortcut = ({ className, ...props }) => {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest text-m3-on-surface-variant", className)}
      {...props}
    />
  )
}
MenubarShortcut.displayName = "MenubarShortcut"

export {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarPortal,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarGroup,
  MenubarSub,
  MenubarShortcut,
}
