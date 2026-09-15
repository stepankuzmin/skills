#!/usr/bin/env node
// usage: node build.ts <flight.geojson> [out.html] [--no-buildings]
//
// Renders assets/template.html with the waypoints, the latest stable Mapbox
// GL JS, and the flyover library. Prints a flight report, then the link to
// open with the token from MAPBOX_ACCESS_TOKEN in the query string.
import { readFileSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compileFlight, type Flight, type FlightCollection, type Waypoint } from "../assets/flyover.ts";

process.removeAllListeners("warning"); // stripTypeScriptTypes still prints an ExperimentalWarning

const args = process.argv.slice(2);
const [input, output = input?.replace(/\.geojson$/, "") + ".html"] = args.filter((a) => !a.startsWith("--"));
if (!input) fail("usage: build.ts <flight.geojson> [out.html] [--no-buildings]");

const token = process.env.MAPBOX_ACCESS_TOKEN;
const flight = validate(JSON.parse(readFileSync(input, "utf8")));
const title = flight.properties?.title ?? "Flyover";
const version = await latestVersion();

const asset = (name: string) => readFileSync(new URL(`../assets/${name}`, import.meta.url), "utf8");
const html = render(asset("template.html"), {
  title: escapeHtml(title),
  version,
  waypoints: literal(flight),
  library: Buffer.from(stripTypeScriptTypes(asset("flyover.ts"))).toString("base64"),
});
writeFileSync(output, html);

report(compileFlight(flight));
if (token && !args.includes("--no-buildings")) await checkBuildings(token);
else console.warn(token ? "warn: building check skipped" : "warn: MAPBOX_ACCESS_TOKEN is not set; the page will ask for a token and the building check is skipped");

console.log(`\n${pathToFileURL(resolve(output))}${token ? `?access_token=${encodeURIComponent(token)}` : ""}`);

// {{slot}} placeholders. Every slot must be provided and every provided slot
// must be used, so a renamed placeholder fails the build.
function render(template: string, slots: Record<string, string>): string {
  const used = new Set<string>();
  const out = template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    if (!(name in slots)) fail(`template: no value for {{${name}}}`);
    used.add(name);
    return slots[name];
  });
  for (const name of Object.keys(slots)) if (!used.has(name)) fail(`template: {{${name}}} is never used`);
  return out;
}

// GeoJSON as a readable JS literal: one line per array of numbers.
function literal(fc: FlightCollection): string {
  return JSON.stringify(fc, null, 4)
    .replace(/\[\s+(-?[\d.]+(?:,\s+-?[\d.]+)*)\s+\]/g, (_, nums: string) => `[${nums.replace(/\s+/g, " ")}]`)
    .replace(/</g, "\\u003c");
}

async function latestVersion(): Promise<string> {
  const url = "https://api.mapbox.com/mapbox-gl-js/versions.json";
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch((e: Error) => fail(`${url}: ${e.message}`));
  if (!res.ok) fail(`${url}: HTTP ${res.status}`);
  const versions: Record<string, { prerelease: boolean }> = await res.json();
  const stable = Object.keys(versions).filter((name) => /^v\d+\.\d+\.\d+$/.test(name) && !versions[name].prerelease).map((name) => name.slice(1));
  stable.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  if (!stable.length) fail(`${url}: no stable release listed`);
  return stable[0];
}

function report(compiled: Flight) {
  const { plan } = compiled;
  const coords = flight.features.map((f) => f.geometry.coordinates);
  console.log(`${output}: ${coords.length} waypoints, ${(plan.distance / 1000).toFixed(1)} km, ${(plan.total / 1000).toFixed(0)} s, mapbox-gl v${version}`);
  plan.phases.filter((p) => p.type === "leg").forEach((leg, i) => {
    const [alt0, alt1] = [coords[i][2], coords[i + 1][2]];
    const turn = i > 0 ? turnAngle(coords[i - 1], coords[i], coords[i + 1]) : 0;
    const hold = flight.features[i + 1].properties?.hold;
    console.log(`  leg ${i + 1}: ${leg.D.toFixed(0)} m, ${leg.vc.toFixed(0)} m/s, ${(leg.T / 1000).toFixed(1)} s, ${alt0}→${alt1} m${turn ? `, turn ${turn.toFixed(0)}°` : ""}${hold ? `, hold ${hold} ms` : ""}`);
    const low = Math.min(alt0, alt1);
    if (leg.vc > low / 3) console.warn(`warn: leg ${i + 1}: ${leg.vc.toFixed(0)} m/s at ${low} m is faster than altitude/3. Fine for a fast brief, a rocket otherwise.`);
    if (turn > 100) console.warn(`warn: waypoint ${i + 1}: ${turn.toFixed(0)}° turn. The spline overshoots hairpins; add a waypoint or widen the turn.`);
  });
}

// Tallest building within 150 m of every waypoint and every leg midpoint,
// compared with the camera height above ground there.
async function checkBuildings(token: string) {
  const coords = flight.features.map((f) => f.geometry.coordinates);
  const spots = coords.map((c, i) => ({ label: `waypoint ${i + 1}`, lng: c[0], lat: c[1], alt: c[2] }));
  for (let i = 0; i < coords.length - 1; i++) {
    const [a, b] = [coords[i], coords[i + 1]];
    spots.push({ label: `between waypoints ${i + 1} and ${i + 2}`, lng: (a[0] + b[0]) / 2, lat: (a[1] + b[1]) / 2, alt: (a[2] + b[2]) / 2 });
  }
  const heights = await Promise.all(spots.map(async ({ lng, lat }) => {
    const url = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lng.toFixed(6)},${lat.toFixed(6)}.json?radius=150&limit=50&layers=building&access_token=${token}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!res?.ok) return null;
    const body: { features: { properties: { height?: number } }[] } = await res.json();
    return body.features.reduce((m, f) => Math.max(m, f.properties.height ?? 0), 0);
  }));
  if (heights.every((h) => h === null)) console.warn("warn: building check skipped: tilequery unavailable");
  spots.forEach((s, i) => {
    const h = heights[i];
    if (h !== null && h > s.alt - 40) console.warn(`warn: ${s.label}: camera ${s.alt.toFixed(0)} m above ground, buildings up to ${h.toFixed(0)} m within 150 m. Raise the camera or move over open ground.`);
  });
}

function turnAngle(a: number[], b: number[], c: number[]) {
  const diff = Math.abs(bearing(b, c) - bearing(a, b)) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function bearing([lng1, lat1]: number[], [lng2, lat2]: number[]) {
  const r = Math.PI / 180;
  const y = Math.sin((lng2 - lng1) * r) * Math.cos(lat2 * r);
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lng2 - lng1) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}

function validate(fc: any): FlightCollection {
  if (fc?.type !== "FeatureCollection" || !Array.isArray(fc.features)) fail("flight must be a GeoJSON FeatureCollection");
  const points: Waypoint[] = fc.features.filter((f: any) => f?.geometry?.type === "Point");
  if (points.length < 2) fail("need at least two Point features");
  points.forEach((f, i) => {
    const c = f.geometry.coordinates;
    if (!Array.isArray(c) || c.length < 3) fail(`waypoint ${i + 1}: coordinates must be [lng, lat, altitude]`);
    checkLngLat(c, `waypoint ${i + 1}`);
    if (typeof c[2] !== "number" || c[2] < 0) fail(`waypoint ${i + 1}: altitude must be a number of meters above ground`);
    const p = f.properties ?? {};
    if (p.lookAt !== undefined) {
      if (!Array.isArray(p.lookAt) || p.lookAt.length < 2) fail(`waypoint ${i + 1}: lookAt must be [lng, lat] or [lng, lat, altitude]`);
      checkLngLat(p.lookAt, `waypoint ${i + 1} lookAt`);
    }
    if (p.hold !== undefined && (typeof p.hold !== "number" || p.hold < 0)) fail(`waypoint ${i + 1}: hold must be milliseconds >= 0`);
    if (p.speed !== undefined && (typeof p.speed !== "number" || p.speed <= 0)) fail(`waypoint ${i + 1}: speed must be m/s > 0`);
  });
  const props = fc.properties ?? {};
  if (props.duration !== undefined && (typeof props.duration !== "number" || props.duration <= 0)) fail("properties.duration must be milliseconds > 0");
  if (props.speed !== undefined && (typeof props.speed !== "number" || props.speed <= 0)) fail("properties.speed must be m/s > 0");
  if (props.ramp !== undefined && (typeof props.ramp !== "number" || props.ramp < 0)) fail("properties.ramp must be milliseconds >= 0");
  return { type: "FeatureCollection", properties: props, features: points };
}

function checkLngLat([lng, lat]: number[], where: string) {
  if (typeof lng !== "number" || lng < -180 || lng > 180) fail(`${where}: longitude ${lng} out of range`);
  if (typeof lat !== "number" || lat < -90 || lat > 90) fail(`${where}: latitude ${lat} out of range`);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
