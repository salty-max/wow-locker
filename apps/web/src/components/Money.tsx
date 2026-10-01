/** Sell price in gold / silver / copper, as the game shows it. */
export function Money({ gold, silver, copper }: { gold: number; silver: number; copper: number }) {
  const coin = (n: number, color: string, key: string) =>
    n > 0 ? (
      <span key={key} className="inline-flex items-center gap-0.5">
        {n}
        <span className="inline-block size-2.5 rounded-full" style={{ background: color }} />
      </span>
    ) : null;
  return (
    <span className="inline-flex gap-1.5 tabular-nums">
      {coin(gold, "radial-gradient(circle at 35% 35%,#fff3a6,#d6a82a 60%,#8a6410)", "g")}
      {coin(silver, "radial-gradient(circle at 35% 35%,#ffffff,#b9bfc8 60%,#6b717c)", "s")}
      {coin(copper, "radial-gradient(circle at 35% 35%,#ffd2b0,#c46a2c 60%,#7a3a12)", "c")}
    </span>
  );
}
