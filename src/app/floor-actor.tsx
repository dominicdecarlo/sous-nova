import { memo } from "react";
import type { ReplayActor } from "@/lib/operations-replay";
import { hash } from "@/lib/operations-replay";
function FloorActor({
  actor,
  time,
  onSelect,
}: {
  actor: ReplayActor;
  time: number;
  onSelect?: (id: string) => void;
}) {
  const phase = time * 15 + (hash(actor.id) % 30),
    step = actor.walking ? Math.sin(phase) * 3 : 0,
    bob = actor.walking ? Math.abs(Math.sin(phase)) * 0.7 : 0,
    action = actor.segment.action;
  const hand =
    action === "chop"
      ? Math.sin(phase * 1.5) * 4
      : action === "clean"
        ? Math.sin(phase * 0.8) * 5
        : action === "plate"
          ? Math.sin(phase) * 2
          : step * 0.6;
  if (actor.kind === "car")
    return (
      <g
        data-actor-id={actor.id}
        transform={`translate(${actor.position.x} ${actor.position.y}) rotate(${actor.angle})`}
        opacity={actor.opacity}
      >
        <title>{`${actor.name}: ${actor.segment.state}`}</title>
        <rect
          x="-24"
          y="-11"
          width="48"
          height="22"
          rx="8"
          fill="#000"
          opacity=".1"
          transform="translate(1 3)"
        />
        <rect
          x="-24"
          y="-11"
          width="48"
          height="22"
          rx="8"
          fill={actor.color}
        />
        <rect x="-8" y="-8" width="18" height="16" rx="3" fill="#d7e8e4" />
        <path d="M-1 -8V8" stroke="#8fa6a1" strokeWidth="2" />
        <rect x="-18" y="-13" width="10" height="3" rx="1" fill="#4c5147" />
        <rect x="-18" y="10" width="10" height="3" rx="1" fill="#4c5147" />
        <rect x="14" y="-9" width="5" height="3" rx="1" fill="#fbebad" />
        <rect x="14" y="6" width="5" height="3" rx="1" fill="#fbebad" />
      </g>
    );
  return (
    <g
      data-actor-id={actor.id}
      data-actor-kind={actor.kind}
      data-actor-state={actor.segment.state}
      className="floor-person"
      transform={`translate(${actor.position.x.toFixed(2)} ${actor.position.y.toFixed(2)})`}
      opacity={actor.opacity}
      onClick={() => onSelect?.(actor.id)}
      role="img"
      aria-label={`${actor.name}: ${actor.segment.state}`}
    >
      <title>{`${actor.name} · ${actor.segment.state}${actor.segment.orderId ? " · " + actor.segment.orderId : ""}`}</title>
      <ellipse cy="7" rx="10" ry="5" fill="#3b3827" opacity=".12" />
      <g transform={`translate(0 ${-bob}) rotate(${actor.angle + 90})`}>
        <ellipse cx="-4" cy={8 + step} rx="3" ry="4" fill="#534c40" />
        <ellipse cx="4" cy={8 - step} rx="3" ry="4" fill="#534c40" />
        <rect x="-8" y="-3" width="16" height="15" rx="6" fill={actor.color} />
        {actor.kind === "chef" && (
          <>
            <path d="M-5 0H5L6 9H-6Z" fill="#e1daca" />
            <path d="M-5 2H5" stroke="#b1b4a5" strokeWidth=".7" />
          </>
        )}
        <path
          d={`M-7 0L-10 ${4 - hand}M7 0L10 ${4 + hand}`}
          fill="none"
          stroke={actor.skin}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cy="-7" r="6.4" fill={actor.skin} />
        {actor.kind === "chef" ? (
          <>
            <path
              d="M-7 -8q-5 -9 1 -11q5 -6 10 0q7 1 4 11Z"
              fill="#fffdf4"
              stroke="#d7dbcf"
              strokeWidth=".6"
            />
            <path d="M-6 -8H7" stroke="#d7dbcf" strokeWidth="1" />
          </>
        ) : (
          <path
            d={
              hash(actor.id) % 2
                ? "M-6 -8q0 -8 7 -6q7 2 5 9l-4 -3l-7 1Z"
                : "M-6 -7q-2 -10 6 -9q9 0 6 10L2 -11Z"
            }
            fill={
              ["#4a3b32", "#6c4e3d", "#3c3532", "#856b4e"][hash(actor.id) % 4]
            }
          />
        )}
        {actor.kind === "dasher" && (
          <>
            <rect
              x="-7"
              y="1"
              width="14"
              height="11"
              rx="3"
              fill="#c64d36"
              stroke="#a54230"
              strokeWidth=".5"
            />
            <text
              y="8.5"
              textAnchor="middle"
              fill="#fff2dd"
              fontSize="5"
              fontFamily="Arial"
              fontWeight="bold"
            >
              DD
            </text>
          </>
        )}
        {actor.segment.carry === "bag" && (
          <g transform="translate(11 1)">
            <rect
              x="-4"
              y="-6"
              width="9"
              height="12"
              rx="1.5"
              fill="#c8a575"
              stroke="#9f825a"
              strokeWidth=".6"
            />
            <path
              d="M-2 -5q2 -6 5 0"
              fill="none"
              stroke="#98794e"
              strokeWidth="1"
            />
            <rect x="-2" y="-1" width="5" height="3" fill="#f1e4c8" />
          </g>
        )}
        {actor.segment.carry === "plate" && (
          <g transform="translate(10 -2)">
            <circle r="6" fill="#f8f7eb" stroke="#c8cbbd" strokeWidth="1" />
            <circle r="3.7" fill="#cfa474" />
            <circle cx="-2" cy="-2" r="1.5" fill="#79a263" />
          </g>
        )}
        {action === "chop" && (
          <g transform={`translate(${10 + hand * 0.4} -9)`}>
            <rect x="-3" y="-2" width="7" height="3" rx=".7" fill="#dbe3de" />
            <path d="M-3 0H-6" stroke="#79634a" strokeWidth="2" />
          </g>
        )}
        {action === "clean" && (
          <rect
            x={5 + hand}
            y="-4"
            width="8"
            height="6"
            rx="2"
            fill="#d1dfc2"
          />
        )}
        {action === "eat" && (
          <path
            d={`M8 -1l${2 + Math.sin(phase * 0.25)} -6`}
            stroke="#9ca794"
            strokeWidth="1.2"
          />
        )}
      </g>
    </g>
  );
}
export default memo(FloorActor);
