import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold",
    "transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-95",
    /* touch-action already set globally, but reinforce */
    "touch-action-manipulation",
    "cursor-pointer",
    /* Minimum touch target */
    "min-h-[44px]",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-orange-500 text-white hover:bg-orange-600 shadow-sm shadow-orange-200",
        destructive: "bg-red-500 text-white hover:bg-red-600",
        outline: "border-2 border-orange-200 bg-white text-orange-700 hover:bg-orange-50",
        secondary: "bg-orange-100 text-orange-800 hover:bg-orange-200",
        ghost: "text-gray-700 hover:bg-gray-100",
        link: "text-orange-600 underline-offset-4 hover:underline p-0 h-auto min-h-0",
        success: "bg-green-500 text-white hover:bg-green-600 shadow-sm shadow-green-200",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-10 px-4 text-xs min-h-[40px]",
        lg: "h-14 px-8 text-base",
        xl: "h-16 px-10 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
