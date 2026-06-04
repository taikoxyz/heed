import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "group/badge font-mono inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-none border border-transparent px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.1em] whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "border-foreground bg-foreground text-background [a]:hover:bg-foreground/85",
        secondary:
          "border-border bg-secondary text-secondary-foreground [a]:hover:bg-foreground/[0.06]",
        destructive:
          "border-destructive bg-transparent text-destructive [a]:hover:bg-destructive/10",
        outline: "border-border text-foreground [a]:hover:bg-foreground/[0.06]",
        signal:
          "border-[var(--signal)] text-[var(--signal)] bg-[color-mix(in_srgb,var(--signal)_10%,transparent)]",
        ghost:
          "border-transparent hover:bg-foreground/[0.05] hover:text-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
