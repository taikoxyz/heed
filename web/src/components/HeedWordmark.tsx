type Props = {
  className?: string;
  height?: number;
};

type Glyph = {
  width: number;
  dots: ReadonlyArray<readonly [number, number]>;
};

const H: Glyph = {
  width: 5,
  dots: [
    [0, 0],
    [4, 0],
    [0, 1],
    [4, 1],
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
    [0, 3],
    [4, 3],
    [0, 4],
    [4, 4],
  ],
};

const E: Glyph = {
  width: 4,
  dots: [
    [1, 0],
    [2, 0],
    [0, 1],
    [3, 1],
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 2],
    [0, 3],
    [1, 4],
    [2, 4],
    [3, 4],
  ],
};

const D: Glyph = {
  width: 4,
  dots: [
    [3, 0],
    [3, 1],
    [1, 2],
    [2, 2],
    [3, 2],
    [0, 3],
    [3, 3],
    [1, 4],
    [2, 4],
    [3, 4],
  ],
};

const GLYPHS: ReadonlyArray<Glyph> = [H, E, E, D];

const GAP = 1;

const { dots: LETTER_DOTS, periodCol } = (() => {
  let cursor = 0;
  const dots: Array<readonly [number, number]> = [];
  for (const glyph of GLYPHS) {
    for (const [col, row] of glyph.dots) {
      dots.push([cursor + col, row]);
    }
    cursor += glyph.width + GAP;
  }
  return { dots, periodCol: cursor };
})();

const STEP = 4;
const DOT = 3;
const RADIUS = 0.7;
const VIEW_WIDTH = (periodCol + 1) * STEP;
const VIEW_HEIGHT = 5 * STEP;

export function HeedWordmark({ className, height = 24 }: Props) {
  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      fill="none"
      role="img"
      aria-label="Heed."
      className={className}
      style={{ height, width: "auto", display: "block" }}
    >
      <g fill="currentColor">
        {LETTER_DOTS.map(([col, row]) => (
          <rect
            key={`${col}-${row}`}
            x={col * STEP + (STEP - DOT) / 2}
            y={row * STEP + (STEP - DOT) / 2}
            width={DOT}
            height={DOT}
            rx={RADIUS}
          />
        ))}
      </g>
      <rect
        x={periodCol * STEP + (STEP - DOT) / 2}
        y={4 * STEP + (STEP - DOT) / 2}
        width={DOT}
        height={DOT}
        rx={RADIUS}
        fill="var(--mantine-color-indigo-5)"
      />
    </svg>
  );
}
