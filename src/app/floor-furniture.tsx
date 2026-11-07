import { memo } from "react";
import type { Config } from "@/lib/simulation";
import type { Replay } from "@/lib/operations-replay";
import { seatPoint } from "@/lib/operations-replay";
function Furniture({
  config,
  plan,
  id,
}: {
  config: Config;
  plan: Replay["plan"];
  id: string;
}) {
  const h = plan.height,
    w = plan.width;
  return (
    <g className="floor-furniture">
      <defs>
        <pattern
          id={`${id}-wood`}
          width="76"
          height="22"
          patternUnits="userSpaceOnUse"
        >
          <rect width="76" height="22" fill="#e9dfca" />
          <path
            d="M0 21.5H76M75.5 0V22M8 7h20M45 14h14"
            stroke="#d9cbb4"
            strokeWidth=".65"
            opacity=".7"
          />
        </pattern>
        <pattern
          id={`${id}-tile`}
          width="30"
          height="30"
          patternUnits="userSpaceOnUse"
        >
          <rect width="30" height="30" fill="#e5e8de" />
          <path d="M30 0H0V30" fill="none" stroke="#d0d8ca" strokeWidth=".6" />
        </pattern>
        <pattern
          id={`${id}-pavement`}
          width="42"
          height="27"
          patternUnits="userSpaceOnUse"
        >
          <rect width="42" height="27" fill="#dde1d6" />
          <path d="M42 0H0V27" fill="none" stroke="#ccd2c5" strokeWidth=".8" />
        </pattern>
        <filter
          id={`${id}-shadow`}
          x="-30%"
          y="-30%"
          width="170%"
          height="180%"
        >
          <feDropShadow
            dx="0"
            dy="3"
            stdDeviation="2"
            floodColor="#5f6043"
            floodOpacity=".16"
          />
        </filter>
      </defs>
      <rect
        x="25"
        y={h - 30}
        width={w - 50}
        height="116"
        rx="8"
        fill={`url(#${id}-pavement)`}
      />
      <path
        d={`M${w - 180} ${h + 65}h-100`}
        stroke="#f5f4e8"
        strokeWidth="3"
        strokeDasharray="15 12"
      />
      <text x="55" y={h + 65} className="street-label">
        MAPLE STREET
      </text>
      <text x={w - 225} y={h + 65} className="street-label">
        PICKUP & ARRIVALS
      </text>
      {config.driveThrough && (
        <>
          <rect x="26" y="0" width={w - 52} height="31" rx="9" fill="#b9c3b3" />
          <path
            d={`M42 15H${w - 40}`}
            stroke="#edf0df"
            strokeDasharray="14 18"
            strokeWidth="1.5"
          />
          <rect x="322" y="27" width="74" height="10" rx="3" fill="#8d9b84" />
        </>
      )}
      <rect
        x="25"
        y="30"
        width={w - 50}
        height={h - 60}
        rx="12"
        fill="#b8c5ad"
        filter={`url(#${id}-shadow)`}
      />
      <rect
        x="32"
        y="37"
        width={w - 64}
        height={h - 74}
        rx="8"
        fill={`url(#${id}-wood)`}
      />
      <rect
        x="32"
        y="37"
        width="308"
        height={h - 74}
        rx="8"
        fill={`url(#${id}-tile)`}
      />
      <path
        d={`M340 37V185M340 267V${h - 157}M340 ${h - 89}V${h - 37}`}
        stroke="#b0bea5"
        strokeWidth="9"
      />
      <rect x="337" y="185" width="7" height="82" fill="#cdd4bf" opacity=".7" />
      <text x="57" y="67" className="room-label">
        THE KITCHEN
      </text>
      <text x="385" y="67" className="room-label">
        {plan.tables.length ? "DINING ROOM" : "ORDER COLLECTION"}
      </text>
      {Array.from({ length: config.stations }, (_, i) => (
        <g
          key={i}
          transform={`translate(${57 + (i % 2) * 103} ${91 + Math.floor(i / 2) * 90})`}
          filter={`url(#${id}-shadow)`}
        >
          <rect width="85" height="55" rx="5" fill="#91a78d" />
          <rect x="4" y="4" width="77" height="44" rx="3" fill="#d3dccb" />
          <rect x="7" y="5" width="71" height="7" rx="2" fill="#bac6b2" />
          {[24, 61].map((x) => (
            <g key={x}>
              <circle cx={x} cy="28" r="11" fill="#52674b" />
              <circle cx={x} cy="28" r="7" fill="#334733" />
              <path
                d={`M${x - 8} 28h16M${x} 20v16`}
                stroke="#758366"
                strokeWidth="1"
              />
            </g>
          ))}
          <rect x="8" y="44" width="24" height="3" rx="1" fill="#a6b397" />
          <circle cx="66" cy="45" r="2" fill="#7e9074" />
          <text x="42" y="76" textAnchor="middle" className="station-label">
            {["GRILL", "SAUTÉ", "PREP", "FRY"][i % 4]} {i + 1}
          </text>
        </g>
      ))}
      <g filter={`url(#${id}-shadow)`}>
        <rect x="285" y="88" width="40" height="130" rx="4" fill="#9eaf92" />
        <rect x="290" y="93" width="30" height="120" rx="3" fill="#edf0e3" />
        <path
          d="M292 122H318M292 155H318M292 187H318"
          stroke="#ccd5c0"
          strokeWidth="2"
        />
        <rect x="282" y="220" width="44" height="27" rx="3" fill="#e2d3b7" />
        <text x="304" y="238" textAnchor="middle" className="pass-label">
          PASS
        </text>
      </g>
      <g transform={`translate(60 ${h - 185})`}>
        <rect width="85" height="58" rx="4" fill="#a9b7a0" />
        <rect x="5" y="5" width="75" height="40" rx="3" fill="#dbe1d3" />
        <rect x="15" y="12" width="40" height="24" rx="5" fill="#93a48b" />
        <path
          d="M48 11V5q0 -7 8 -5"
          fill="none"
          stroke="#7c8f75"
          strokeWidth="3"
        />
        <text x="42" y="76" textAnchor="middle" className="station-label">
          WASH & RESET
        </text>
      </g>
      {plan.tables.map((t) => (
        <g data-dining-table={t.id} key={t.id} className="dining-table">
          <title>{`Table ${t.id + 1}: ${t.seats} seats`}</title>
          {Array.from({ length: Math.min(t.seats, 12) }, (_, i) => {
            const p = seatPoint(t, i);
            return (
              <g
                key={i}
                transform={`translate(${p.x} ${p.y}) rotate(${(i / t.seats) * 360})`}
              >
                <rect
                  x="-8"
                  y="-10"
                  width="16"
                  height="20"
                  rx="4"
                  fill="#78916f"
                />
                <rect
                  x="-5"
                  y="-7"
                  width="10"
                  height="14"
                  rx="3"
                  fill="#8fa483"
                />
              </g>
            );
          })}
          <rect
            x={t.x - 26}
            y={t.y - 24}
            width="52"
            height="52"
            rx="8"
            fill="#b99d76"
            filter={`url(#${id}-shadow)`}
          />
          <rect
            x={t.x - 23}
            y={t.y - 23}
            width="46"
            height="45"
            rx="7"
            fill="#f7eedb"
          />
          <path
            d={`M${t.x - 18} ${t.y - 18}h36`}
            stroke="#fffdf3"
            strokeWidth="1.5"
          />
          <circle cx={t.x} cy={t.y - 10} r="5" fill="#d7dec3" />
          <path
            d={`M${t.x - 3} ${t.y - 10}q3 -9 6 0q-3 4 -6 0`}
            fill="#83a16d"
          />
          <text
            x={t.x}
            y={t.y + 15}
            textAnchor="middle"
            className="table-number"
          >
            {t.id + 1}
          </text>
        </g>
      ))}
      {!plan.tables.length && (
        <g data-pickup-area="true">
          <rect
            x="419"
            y="110"
            width="300"
            height="85"
            rx="6"
            fill="#bba17b"
            filter={`url(#${id}-shadow)`}
          />
          <rect x="424" y="115" width="290" height="70" rx="4" fill="#e7d7b9" />
          <path d="M429 151H708" stroke="#bca582" strokeWidth="4" />
          <text x="569" y="139" textAnchor="middle" className="counter-label">
            PICKUP SHELVES
          </text>
          <rect x="442" y="236" width="250" height="46" rx="5" fill="#adbc9b" />
          <text x="567" y="262" textAnchor="middle" className="counter-label">
            DASHER & CUSTOMER COLLECTION
          </text>
          <rect x="696" y="304" width="32" height="32" rx="7" fill="#b99b77" />
          <circle cx="712" cy="311" r="21" fill="#8ca479" />
          <circle cx="705" cy="302" r="12" fill="#a2b48d" />
        </g>
      )}
      <g transform={`translate(310 ${h - 145})`} filter={`url(#${id}-shadow)`}>
        <rect width="92" height="39" rx="5" fill="#9e7e58" />
        <rect x="-4" y="-3" width="101" height="31" rx="5" fill="#d6bc94" />
        <rect x="16" y="4" width="45" height="12" rx="2" fill="#eee1c3" />
        <text x="39" y="13" textAnchor="middle" className="pickup-label">
          PICKUP
        </text>
        <rect x="73" y="2" width="14" height="15" rx="2" fill="#61785a" />
        <rect x="76" y="5" width="8" height="7" fill="#b5c99b" />
      </g>
      <rect
        x={w - 143}
        y={h - 81}
        width="77"
        height="39"
        rx="3"
        fill="#b6bd9c"
        opacity=".5"
      />
      <text x={w - 104} y={h - 61} textAnchor="middle" className="mat-label">
        WELCOME
      </text>
      <path
        d={`M${w - 145} ${h - 37}h82M148 ${h - 37}h60`}
        stroke="#f9f6e9"
        strokeWidth="11"
      />
      <path
        d={`M${w - 145} ${h - 37}l18 -29`}
        stroke="#b3c0a8"
        strokeWidth="2"
      />
      <text x="177" y={h - 10} textAnchor="middle" className="station-label">
        TEAM ENTRANCE
      </text>
      {Array.from(
        { length: Math.min(7, Math.floor((w - 420) / 160)) },
        (_, i) => (
          <g key={i} transform={`translate(${428 + i * 160} 38)`}>
            <rect width="75" height="10" rx="3" fill="#b5cbb5" />
            <path d="M37 0V10" stroke="#91aa90" strokeWidth="2" />
          </g>
        ),
      )}
    </g>
  );
}
export default memo(Furniture);
