import { cn } from "@/lib/utils";

function Progress({
  className,
  value,
  ...props
}: Omit<React.ComponentProps<"div">, "role"> & { value?: number }) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className,
      )}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className="bg-primary h-full transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export { Progress };
