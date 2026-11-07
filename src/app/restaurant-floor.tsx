"use client";
import { useId, useMemo, useState } from "react";
import { ChefHat, PackageCheck, UtensilsCrossed, X } from "lucide-react";
import type { Config, Frame, Order } from "@/lib/simulation";
import {
  buildReplay,
  replayAt,
  seatPoint,
  stationPoint,
} from "@/lib/operations-replay";
import Furniture from "./floor-furniture";
import FloorActor from "./floor-actor";
export default function RestaurantFloor({
  frame,
  config,
  playing,
  orders = [],
  time = frame.minute,
}: {
  frame: Frame;
  config: Config;
  playing: boolean;
  orders?: Order[];
  time?: number;
}) {
  const [zoom, setZoom] = useState<"fit" | "actual">("fit"),
    [selected, setSelected] = useState<string | null>(null),
    id = useId().replaceAll(":", "");
  const replay = useMemo(() => buildReplay(config, orders), [config, orders]),
    plan = replay.plan,
    scene = replayAt(replay, time);
  const selectedActor = scene.actors.find((a) => a.id === selected);
  const cooking = scene.actors.filter(
    (a) =>
      a.kind === "chef" && ["Cooking", "Plating"].includes(a.segment.state),
  ).length;
  const diners = scene.actors.filter(
    (a) =>
      a.kind === "guest" &&
      ["Waiting for food", "Enjoying a meal"].includes(a.segment.state),
  ).length;
  const waiting = scene.actors.filter(
    (a) =>
      ["dasher", "pickup"].includes(a.kind) &&
      a.segment.state === "Waiting for order",
  ).length;
  const readyOrders = orders.filter(
    (o) =>
      o.channel !== "dineIn" &&
      o.ready <= time &&
      time <
        (o.serviceStart ?? Infinity) +
          ((o.finish - (o.serviceStart ?? o.finish)) * 0.28 || 0),
  );
  return (
    <div className="restaurant-floor polished-floor">
      <div className="floor-toolbar">
        <span>
          {plan.tables.length
            ? `${plan.tables.length} tables · ${config.seats} seats`
            : "Takeout only · collection shelves, no dining"}
          <small> · {config.stations} kitchen stations</small>
        </span>
        <div role="group" aria-label="Floor plan zoom">
          <button aria-pressed={zoom === "fit"} onClick={() => setZoom("fit")}>
            Fit
          </button>
          <button
            aria-pressed={zoom === "actual"}
            onClick={() => setZoom("actual")}
          >
            100%
          </button>
        </div>
      </div>
      <div className="floor-pulse">
        <span>
          <ChefHat size={12} />
          <b>{cooking}</b> cooking
        </span>
        <span>
          <UtensilsCrossed size={12} />
          <b>{diners}</b> dining
        </span>
        <span className="dasher-pulse">
          <PackageCheck size={12} />
          <b>{waiting}</b> awaiting pickup
        </span>
        <small>{playing ? "SERVICE IN MOTION" : "REPLAY PAUSED"}</small>
      </div>
      <div
        className="floor-viewport"
        tabIndex={0}
        aria-label="Animated restaurant floor. Scroll to explore at 100 percent zoom."
      >
        <svg
          className={`floor ${playing ? "" : "paused"}`}
          viewBox={`0 0 ${plan.width} ${plan.height + 105}`}
          style={{
            width: zoom === "fit" ? "100%" : plan.width,
            height: "auto",
            maxHeight: "none",
          }}
          role="img"
          aria-label={`${config.seats === 0 ? "Takeout collection area" : `Dining room with ${plan.tables.length} tables and ${config.seats} seats`}; ${scene.actors.length} people and vehicles following their orders; minute ${Math.floor(time)}`}
        >
          <Furniture config={config} plan={plan} id={id} />
          {scene.cooking.map((o) => {
            const i = o.stationId ?? 0,
              x = 57 + (i % 2) * 103,
              y = 91 + Math.floor(i / 2) * 90,
              progress = Math.min(1, (time - o.start) / o.prep),
              hot = time < o.ready - 2.1;
            return (
              <g key={o.id} data-station-order={o.id}>
                {hot && (
                  <>
                    <circle
                      cx={x + 24}
                      cy={y + 28}
                      r="7"
                      fill="#e3a258"
                      opacity={0.6 + Math.sin(time * 9) * 0.25}
                    />
                    <circle
                      cx={x + 61}
                      cy={y + 28}
                      r="6"
                      fill="#b98543"
                      opacity={0.6 + Math.sin(time * 8) * 0.2}
                    />
                    {[0, 1, 2].map((s) => (
                      <path
                        key={s}
                        d={`M${x + 21 + s * 4} ${y + 14 - ((time * 13 + s * 6) % 18)}q-3 -5 0 -9`}
                        stroke="#fffdf4"
                        strokeWidth="1.7"
                        opacity={1 - ((time * 13 + s * 6) % 18) / 18}
                        fill="none"
                      />
                    ))}
                  </>
                )}
                <rect
                  x={x + 7}
                  y={y - 11}
                  width="71"
                  height="5"
                  rx="2.5"
                  fill="#d5ddc9"
                />
                <rect
                  x={x + 7}
                  y={y - 11}
                  width={71 * progress}
                  height="5"
                  rx="2.5"
                  fill={hot ? "#89a576" : "#d2aa68"}
                />
                <text
                  x={x + 43}
                  y={y - 17}
                  textAnchor="middle"
                  className="order-ticket-label"
                >
                  {o.id.replace("MSK-", "#")} · {hot ? "COOKING" : "PLATING"}
                </text>
              </g>
            );
          })}
          {readyOrders.slice(0, 7).map((o, i) => (
            <g
              key={o.id}
              transform={`translate(304 ${108 + i * 15})`}
              data-ready-order={o.id}
            >
              <rect
                x="-9"
                y="-7"
                width="18"
                height="13"
                rx="2"
                fill="#c8a574"
                stroke="#ab8c60"
                strokeWidth=".6"
              />
              <path
                d="M-4 -5q4 -8 8 0"
                fill="none"
                stroke="#9e8155"
                strokeWidth="1"
              />
              <rect x="-5" y="-2" width="10" height="4" fill="#f3e9d2" />
            </g>
          ))}
          {scene.meals.map((meal) => {
            const table = plan.tables[meal.tableId];
            return (
              <g key={meal.orderId} data-table-meal={meal.orderId}>
                {Array.from({ length: meal.partySize }, (_, member) => {
                  const seat = seatPoint(
                    table,
                    Math.floor((member * table.seats) / meal.partySize),
                  );
                  const angle = Math.atan2(seat.y - table.y, seat.x - table.x),
                    x = table.x + Math.cos(angle) * 14,
                    y = table.y + Math.sin(angle) * 14;
                  return (
                    <g key={member}>
                      <circle
                        cx={x}
                        cy={y}
                        r="6.4"
                        fill="#fffdf4"
                        stroke="#e1dfcc"
                        strokeWidth=".8"
                      />
                      <circle cx={x} cy={y} r="3.6" fill="#b97b46" />
                      <circle cx={x - 2} cy={y - 2} r="1.5" fill="#82a565" />
                      <path
                        d={`M${x + 3} ${y - 2}l2 1`}
                        stroke="#e0b760"
                        strokeWidth="1.5"
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
          {scene.actors
            .filter((a) => a.kind !== "car")
            .sort((a, b) => a.position.y - b.position.y)
            .map((actor) => (
              <FloorActor
                key={actor.id}
                actor={actor}
                time={time}
                onSelect={setSelected}
              />
            ))}
          {scene.actors
            .filter((a) => a.kind === "car")
            .map((actor) => (
              <FloorActor key={actor.id} actor={actor} time={time} />
            ))}
        </svg>
      </div>
      {selected && (
        <div className="floor-inspector">
          <span
            className="inspector-avatar"
            style={{ background: selectedActor?.color ?? "#acb99c" }}
          >
            {selectedActor?.kind === "chef" ? (
              <ChefHat size={17} />
            ) : (
              <UtensilsCrossed size={15} />
            )}
          </span>
          <div>
            <strong>{selectedActor?.name ?? "Journey complete"}</strong>
            <small>
              {selectedActor
                ? `${selectedActor.segment.state}${selectedActor.segment.orderId ? " · " + selectedActor.segment.orderId : ""}`
                : "This guest or teammate has left the floor."}
            </small>
          </div>
          <button
            className="icon-button"
            aria-label="Close person details"
            onClick={() => setSelected(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="floor-story">
        <div className="floor-story-heading">
          <span className="live-dot" />
          ON THE FLOOR <small>Tap a person to see what they’re doing</small>
        </div>
        {scene.events.length ? (
          <div className="floor-events">
            {scene.events.slice(0, 3).map((event) => (
              <div key={event.id}>
                <i className={`event-dot event-${event.kind}`} />
                <span>{event.label}</span>
                <small>
                  {time - event.time < 1
                    ? "just now"
                    : `${Math.floor(time - event.time)}m ago`}
                </small>
              </div>
            ))}
          </div>
        ) : (
          <div className="floor-opening-note">
            The team is getting ready. First orders are on their way.
          </div>
        )}
      </div>
    </div>
  );
}
