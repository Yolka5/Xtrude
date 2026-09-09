import { Icon } from "./Icon";

/**
 * Week-over-week rank movement.
 *
 * Three independent signals for one fact - arrow direction, a number, and
 * colour - so the meaning survives colour blindness and greyscale printing.
 */
export function Movement({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span className="move move--same">
        <Icon name="same" size={13} />
        <span className="sr-only">No change in rank</span>
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span className={`move ${up ? "move--up" : "move--down"}`}>
      <Icon name={up ? "up" : "down"} size={13} />
      <span aria-hidden="true">{Math.abs(delta)}</span>
      <span className="sr-only">
        {up ? `Up ${delta} places since last week` : `Down ${Math.abs(delta)} places since last week`}
      </span>
    </span>
  );
}
