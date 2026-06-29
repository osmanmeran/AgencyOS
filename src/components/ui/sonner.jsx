"use client";
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

const Toaster = ({ ...props }) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-m3-surface group-[.toaster]:text-m3-on-surface group-[.toaster]:border-m3-outline-variant group-[.toaster]:shadow-lg group-[.toaster]:rounded-large",
          description: "group-[.toast]:text-m3-on-surface-variant",
          actionButton:
            "group-[.toast]:bg-m3-primary group-[.toast]:text-m3-primary-foreground group-[.toast]:rounded-full",
          cancelButton:
            "group-[.toast]:bg-m3-secondary-container group-[.toast]:text-m3-secondary-container-foreground group-[.toast]:rounded-full",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
