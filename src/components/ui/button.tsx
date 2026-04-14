import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black hover:from-sdhq-cyan-600 hover:to-sdhq-green-600",
        destructive: "bg-red-500 text-white hover:bg-red-600",
        outline: "border-2 border-sdhq-cyan-500 text-sdhq-cyan-600 hover:bg-sdhq-cyan-50",
        secondary: "bg-sdhq-cyan-100 text-sdhq-cyan-700 hover:bg-sdhq-cyan-200",
        ghost: "hover:bg-sdhq-cyan-50 text-sdhq-cyan-600",
        link: "text-sdhq-cyan-600 underline-offset-4 hover:underline",
        neon: "bg-black text-sdhq-cyan-400 border border-sdhq-cyan-500 hover:bg-sdhq-cyan-950 hover:text-white hover:shadow-neon-cyan transition-all duration-300",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
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
