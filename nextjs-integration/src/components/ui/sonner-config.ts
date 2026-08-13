import { toast } from "sonner"

// Configure toast options
type ToastOptions = {
  duration?: number
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  style?: React.CSSProperties
  className?: string
  closeButton?: boolean
  richColors?: boolean
  expand?: boolean
  theme?: 'light' | 'dark' | 'system'
}

// Global toast configuration
export const toastConfig: ToastOptions = {
  position: 'top-right',
  richColors: true,
  closeButton: true,
  expand: false,
  theme: 'light',
  duration: 4000,
}

// Export configured toast function
export { toast }