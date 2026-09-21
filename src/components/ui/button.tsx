import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sdhq-cyan-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black shadow-md shadow-sdhq-cyan-500/20 hover:from-sdhq-cyan-400 hover:to-sdhq-green-400 hover:shadow-lg",
        destructive: "bg-red-500 text-white shadow-md shadow-red-500/20 hover:bg-red-600 hover:shadow-lg",
        outline: "border-2 border-sdhq-cyan-500/80 text-sdhq-cyan-600 hover:bg-sdhq-cyan-50 hover:shadow-md",
        secondary: "bg-sdhq-cyan-100 text-sdhq-cyan-800 hover:bg-sdhq-cyan-200",
        ghost: "hover:bg-sdhq-cyan-50 text-sdhq-cyan-600",
        link: "text-sdhq-cyan-600 underline-offset-4 hover:underline hover:translate-y-0",
        neon: "bg-black text-sdhq-cyan-400 border border-sdhq-cyan-500 hover:bg-sdhq-cyan-950 hover:text-white hover:shadow-neon-cyan",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
