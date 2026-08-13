import { type ReactNode } from "react"
import { Toaster } from "sonner"

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        expand={false}
        theme="light"
      />
    </>
  )
}