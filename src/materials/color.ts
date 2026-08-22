/** Small hex helpers so finishes can be tinted without pulling in a colour library. */

function channels(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex(rgb: number[]): string {
  return `#${rgb
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function mixHex(from: string, to: string, ratio: number): string {
  const t = Math.max(0, Math.min(1, ratio));
  const a = channels(from);
  const b = channels(to);
  return toHex(a.map((channel, index) => channel + (b[index] - channel) * t));
}

/** Positive lightens toward white, negative darkens toward black. */
export function shadeHex(color: string, amount: number): string {
  const target = amount >= 0 ? 255 : 0;
  return toHex(
    channels(color).map((channel) => channel + (target - channel) * Math.abs(amount)),
  );
}
