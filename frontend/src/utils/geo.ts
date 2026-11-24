export interface LatLon { lat: number; lon: number }
export const validLat = (v: number) => Number.isFinite(v) && v >= -90 && v <= 90;
export const validLon = (v: number) => Number.isFinite(v) && v >= -180 && v <= 180;
export const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Bounding box [west, south, east, north] of a +/- half-size (degrees) square around a point. */
export function bboxAround(c: LatLon, halfDeg: number): [number, number, number, number] {
  return [clamp(c.lon - halfDeg, -180, 180), clamp(c.lat - halfDeg, -90, 90), clamp(c.lon + halfDeg, -180, 180), clamp(c.lat + halfDeg, -90, 90)];
}

/** Approximate area of a lat/lon box in km² (spherical Earth). */
export function bboxAreaKm2(b: [number, number, number, number]): number {
  const R = 6371.0088, rad = Math.PI / 180;
  return R * R * (b[2] - b[0]) * rad * (Math.sin(b[3] * rad) - Math.sin(b[1] * rad));
}
export const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const fmt = (v: number | null | undefined, digits = 1): string => (v === null || v === undefined ? "—" : v.toLocaleString(undefined, { maximumFractionDigits: digits }));
