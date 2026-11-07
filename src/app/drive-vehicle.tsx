import type { ReplayActor } from "@/lib/operations-replay";
import { hash } from "@/lib/operations-replay";
export function vehicleType(id: string) {
  return ["sedan", "truck", "suv"][hash(id) % 3];
}
export default function DriveVehicle({ actor }: { actor: ReplayActor }) {
  const type = vehicleType(actor.id),
    paint = [
      "#b95143",
      "#527c9b",
      "#e7cf96",
      "#55765e",
      "#77628b",
      "#d5d8d1",
      "#414d59",
    ][hash(actor.id + "paint") % 7],
    truck = type === "truck",
    suv = type === "suv",
    length = truck ? 58 : suv ? 52 : 46,
    width = suv ? 26 : 22;
  return (
    <g
      data-actor-id={actor.id}
      data-actor-kind="car"
      data-vehicle-type={type}
      data-vehicle-color={paint}
      transform={`translate(${actor.position.x} ${actor.position.y}) rotate(${actor.walking ? actor.angle : 180})`}
      opacity={actor.opacity}
      role="img"
      aria-label={`${type}: ${actor.segment.state}`}
    >
      <title>{`${type} · ${actor.name}: ${actor.segment.state}`}</title>
      <rect
        x={-length / 2 + 1}
        y={-width / 2 + 3}
        width={length}
        height={width}
        rx={truck ? 4 : 9}
        fill="#000"
        opacity=".14"
      />
      {[-1, 1].flatMap((side) =>
        [-1, 1].map((end) => (
          <rect
            key={`${side}-${end}`}
            x={end * length * 0.3 - 5}
            y={side * (width / 2 + 1) - 2}
            width="10"
            height="4"
            rx="1"
            fill="#303a38"
          />
        )),
      )}
      <rect
        x={-length / 2}
        y={-width / 2}
        width={length}
        height={width}
        rx={truck ? 4 : suv ? 6 : 10}
        fill={paint}
      />
      {truck ? (
        <>
          <rect x="-25" y="-8" width="22" height="16" rx="1" fill="#343f40" />
          <path
            d="M-23 -5H-6M-23 0H-6M-23 5H-6"
            stroke="#60716e"
            strokeWidth="1"
          />
          <rect x="1" y="-8" width="14" height="16" rx="2" fill="#b9d9df" />
        </>
      ) : (
        <>
          <rect
            x={suv ? -15 : -12}
            y={suv ? -10 : -8}
            width={suv ? 29 : 23}
            height={suv ? 20 : 16}
            rx={suv ? 3 : 6}
            fill="#b9d9df"
          />
          <rect
            x="-6"
            y={suv ? -9 : -7}
            width="11"
            height={suv ? 18 : 14}
            rx="2"
            fill={paint}
          />
          {suv && (
            <path d="M-15 -11H14M-15 11H14" stroke="#374542" strokeWidth="2" />
          )}
        </>
      )}
      <rect
        x={length / 2 - 5}
        y={-width / 2 + 2}
        width="4"
        height="4"
        rx="1"
        fill="#ffefb0"
      />
      <rect
        x={length / 2 - 5}
        y={width / 2 - 6}
        width="4"
        height="4"
        rx="1"
        fill="#ffefb0"
      />
      <path
        d={`M${-length / 2 + 2} ${-width / 2 + 3}v4M${-length / 2 + 2} ${width / 2 - 7}v4`}
        stroke="#d84435"
        strokeWidth="2"
      />
    </g>
  );
}
