import type { Floor, FloorPlan, Room } from "../types/floorPlan";
import type { UserIntent } from "./intentAgent";
import type { FollowUp } from "./types";

export function narrateEdit(
  intent: UserIntent,
  before: FloorPlan,
  after: FloorPlan,
): { reply: string; followUp?: FollowUp } {
  if (intent.kind === "resize_room") {
    return narrateResize(intent, before, after);
  }
  if (intent.kind === "hide_roof") {
    return {
      reply: "The roof is off — you can see the top plate.",
      followUp: {
        prompt: "Want a roof back on?",
        options: [
          {
            id: "roof-on",
            label: "Add the roof",
            detail: "Cap the top floor",
            recommended: true,
            prompt: "add the roof",
          },
          { id: "leave", label: "Leave it off", detail: "Keep the top open" },
        ],
      },
    };
  }
  if (intent.kind === "show_roof") {
    return { reply: "Roof is back on the top floor." };
  }
  if (intent.kind === "keep_roof") {
    return { reply: "Keeping the roof on." };
  }
  if (intent.kind === "read_drawing") {
    return {
      reply:
        "I can read that elevation on the local vision model, but it is not reachable. Check the GB10 at 10.0.1.20:8080.",
    };
  }
  return {
    reply: `Edit agent applied the change to the live FloorPlan.`,
  };
}

function narrateResize(
  intent: Extract<UserIntent, { kind: "resize_room" }>,
  before: FloorPlan,
  after: FloorPlan,
): { reply: string; followUp?: FollowUp } {
  const found = findRoom(before, intent.roomId);
  const name = found?.room.name ?? intent.roomId;
  const roofOff = after.roof.visible === false;
  const area = formatArea(intent.areaSqM);

  if (!intent.stack) {
    const reply = `${name} is now ${area}. I left the other floors alone, so this storey steps back — the leftover slab below is an open deck.`;
    return {
      reply,
      followUp: roofOff
        ? {
            prompt: "The top is open. Want a roof on the new plate?",
            options: [
              {
                id: "roof-on",
                label: "Add a roof",
                detail: "Cap the smaller top floor",
                recommended: true,
                prompt: "add the roof",
              },
              { id: "leave", label: "Leave it open", detail: "Keep it as a deck" },
            ],
          }
        : {
            prompt: "The roof now sits on that smaller plate. Want it off so you can see the setback?",
            options: [
              {
                id: "roof-off",
                label: "Take the roof off",
                detail: "See the stepped floors",
                prompt: "remove the roof",
              },
              {
                id: "leave",
                label: "Keep the roof",
                detail: "Leave the house as it is",
                recommended: true,
              },
            ],
          },
    };
  }

  const reply = `${name} is now ${area}. I moved every floor with it so the walls still sit on the foundation.`;
  return {
    reply,
    followUp: roofOff
      ? {
          prompt: "Want a roof on the new envelope?",
          options: [
            {
              id: "roof-on",
              label: "Add a roof",
              detail: "Cap the stacked floors",
              recommended: true,
              prompt: "add the roof",
            },
            { id: "leave", label: "Leave it open", detail: "Keep the top bare" },
          ],
        }
      : {
          prompt: "Want the roof off so you can see the new plate?",
          options: [
            {
              id: "roof-off",
              label: "Take the roof off",
              detail: "See the stacked walls",
              prompt: "remove the roof",
            },
            {
              id: "leave",
              label: "Keep the roof",
              detail: "Leave it on",
              recommended: true,
            },
          ],
        },
  };
}

function findRoom(
  plan: FloorPlan,
  roomId: string,
): { floor: Floor; room: Room } | undefined {
  for (const floor of plan.floors) {
    const room = floor.rooms.find((entry) => entry.id === roomId);
    if (room) {
      return { floor, room };
    }
  }
  return undefined;
}

function formatArea(areaSqM: number): string {
  const rounded = Math.round(areaSqM * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} m²`;
}
