type Props = {
  className?: string;
};

const H_DOTS: ReadonlyArray<[number, number]> = [
  [2.5, 0.5],
  [2.5, 4.5],
  [2.5, 8.5],
  [2.5, 12.5],
  [2.5, 16.5],
  [6.5, 8.5],
  [10.5, 8.5],
  [14.5, 8.5],
  [18.5, 0.5],
  [18.5, 4.5],
  [18.5, 8.5],
  [18.5, 12.5],
  [18.5, 16.5],
];

export function HeedMark({ className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <g fill="currentColor">
        {H_DOTS.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="3" height="3" rx="0.7" />
        ))}
      </g>
      <rect
        x="18.5"
        y="20.5"
        width="3"
        height="3"
        rx="0.7"
        className="fill-primary"
      />
    </svg>
  );
}
