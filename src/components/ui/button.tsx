import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * HustlerLink buttons.
 * Sunlight rules: solid fills only, no translucency, 48dp minimum height,
 * icon strokes thick, label never below 16px on primary actions.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl font-bold cursor-pointer transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.99] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-[1.25em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-soft hover:bg-primary-ink",
        accent: "bg-accent text-accent-foreground shadow-soft hover:brightness-95",
        soft: "bg-primary-soft text-primary-ink hover:bg-accent-soft hover:text-accent-foreground",
        outline:
          "border-2 border-border-strong bg-card text-foreground hover:border-primary hover:text-primary-ink",
        secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground shadow-soft hover:brightness-95",
        link: "text-primary-ink underline underline-offset-4",
      },
      size: {
        default: "h-12 px-6 text-base",
        sm: "h-11 rounded-xl px-4 text-[0.9375rem]",
        lg: "h-14 px-7 text-[1.0625rem]",
        icon: "size-12 rounded-2xl",
        pill: "h-12 rounded-full px-5 text-base",
      },
      block: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, block, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
