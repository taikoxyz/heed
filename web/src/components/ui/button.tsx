import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button font-heading inline-flex shrink-0 items-center justify-center rounded-none border border-transparent bg-clip-padding text-xs font-medium uppercase tracking-[0.12em] whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-foreground text-background border-foreground hover:bg-foreground/85 hover:border-foreground/85",
        outline:
          "border-foreground text-foreground bg-transparent hover:bg-foreground/[0.06] aria-expanded:bg-foreground/[0.06] dark:hover:bg-foreground/[0.08] dark:aria-expanded:bg-foreground/[0.08]",
        secondary:
          "border-border bg-secondary text-secondary-foreground hover:bg-foreground/[0.06] aria-expanded:bg-foreground/[0.06]",
        ghost:
          "border-transparent text-foreground hover:bg-foreground/[0.05] hover:text-foreground aria-expanded:bg-foreground/[0.05]",
        destructive:
          "border-destructive bg-transparent text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/40",
        link: "border-0 border-b border-foreground text-foreground normal-case tracking-normal hover:text-foreground/70 hover:border-foreground/40 rounded-none px-0",
      },
      size: {
        default: "h-9 gap-1.5 px-3.5",
        xs: "h-7 gap-1 px-2 text-[0.65rem] tracking-[0.14em] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-3 text-[0.7rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-6 text-[0.78rem] tracking-[0.16em]",
        icon: "size-9",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
