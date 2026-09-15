#!/usr/bin/env node
// usage: node build.mjs <waypoints.geojson> [out.html] [--no-buildings]
//
// Inlines the waypoints, the MAPBOX_ACCESS_TOKEN env var, the latest
// Mapbox GL JS version and its CSS into assets/template.html, then prints a
// flight report: per-leg speed, turns, and building clearance.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { planFlight } from "../assets/flight.js";

const FALLBACK_VERSION = "3.30.0";
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const checkBuildings = !process.argv.includes("--no-buildings");
const [input, output = input?.replace(/\.geojson$/, "") + ".html"] = args;

if (!input) fail("usage: build.mjs <waypoints.geojson> [out.html] [--no-buildings]");

const token = process.env.MAPBOX_ACCESS_TOKEN;
if (!token) fail("MAPBOX_ACCESS_TOKEN is not set");
if (!/^[\w.-]+$/.test(token)) fail("MAPBOX_ACCESS_TOKEN contains unexpected characters");

const assets = join(dirname(fileURLToPath(import.meta.url)), "../assets");

const flight = JSON.parse(readFileSync(input, "utf8"));
validate(flight);

const version = (await fetchText("https://registry.npmjs.org/mapbox-gl/latest", (t) => JSON.parse(t).version)) ?? FALLBACK_VERSION;
const cssUrl = `https://cdn.jsdelivr.net/npm/mapbox-gl@${version}/dist/mapbox-gl.css`;
const css = await fetchText(cssUrl);
const cssTag = css ? `<style>${css}</style>` : `<link rel="stylesheet" href="${cssUrl}">`;

const html = readFileSync(join(assets, "template.html"), "utf8")
  .split("__TITLE__").join(escapeHtml(flight.properties?.title ?? "Flyover"))
  .split("__VERSION__").join(version)
  .split("__CSS__").join(cssTag)
  .split("__FLIGHT_JS__").join(readFileSync(join(assets, "flight.js"), "utf8").replace(/^export /gm, ""))
  .split("__TOKEN__").join(token)
  .split("__WAYPOINTS__").join(JSON.stringify(flight).replace(/</g, "\\u003c"));

writeFileSync(output, html);
await report();

async function report() {
  const opts = Object.assign({ duration: 45000, speed: null, ramp: 1500 }, flight.properties ?? {});
  const points = flight.features.filter((f) => f.geometry?.type === "Point");
  const coords = points.map((f) => f.geometry.coordinates);
  const cumulative = [0];
  for (let i = 1; i < coords.length; i++) cumulative.push(cumulative[i - 1] + haversine(coords[i - 1], coords[i]));
  const plan = planFlight(
    points.map((f, i) => ({ d: cumulative[i], hold: f.properties?.hold ?? 0, speed: f.properties?.speed ?? null })),
    opts,
  );

  console.log(`${output}: ${points.length} waypoints, ${(plan.distance / 1000).toFixed(1)} km, ${(plan.total / 1000).toFixed(0)} s, mapbox-gl ${version}${css ? "" : " (CSS linked, not inlined)"}`);
  const warnings = [];
  plan.legs.forEach((leg, i) => {
    const alt0 = coords[i][2], alt1 = coords[i + 1][2];
    const turn = i > 0 ? turnAngle(coords[i - 1], coords[i], coords[i + 1]) : 0;
    console.log(`  leg ${i + 1}: ${leg.D.toFixed(0)} m, ${leg.vc.toFixed(0)} m/s, ${(leg.T / 1000).toFixed(1)} s, ${alt0}→${alt1} m${turn ? `, turn ${turn.toFixed(0)}°` : ""}${points[i + 1].properties?.hold ? `, hold ${points[i + 1].properties.hold} ms` : ""}`);
    const low = Math.min(alt0, alt1);
    if (leg.vc > low / 3) warnings.push(`leg ${i + 1}: ${leg.vc.toFixed(0)} m/s at ${low} m is faster than altitude/3. Fine for a fast brief, a rocket otherwise.`);
    if (turn > 100) warnings.push(`waypoint ${i + 1}: ${turn.toFixed(0)}° turn. The spline overshoots hairpins; add a waypoint or widen the turn.`);
  });

  if (checkBuildings) {
    const spots = [];
    coords.forEach((c, i) => spots.push({ label: `waypoint ${i + 1}`, lng: c[0], lat: c[1], alt: c[2] }));
    for (let i = 0; i < coords.length - 1; i++) {
      spots.push({ label: `between waypoints ${i + 1} and ${i + 2}`, lng: (coords[i][0] + coords[i + 1][0]) / 2, lat: (coords[i][1] + coords[i + 1][1]) / 2, alt: (coords[i][2] + coords[i + 1][2]) / 2 });
    }
    const heights = await Promise.all(spots.map((s) => tallestBuilding(s.lng, s.lat)));
    if (heights.every((h) => h === null)) warnings.push("building check skipped: tilequery unavailable");
    spots.forEach((s, i) => {
      if (heights[i] !== null && heights[i] > s.alt - 40) warnings.push(`${s.label}: camera ${s.alt.toFixed(0)} m above ground, buildings up to ${heights[i].toFixed(0)} m within 150 m. Raise the camera or move over open ground.`);
    });
  }
  warnings.forEach((w) => console.warn(`warn: ${w}`));
}

async function tallestBuilding(lng, lat) {
  const url = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lng.toFixed(6)},${lat.toFixed(6)}.json?radius=150&limit=50&layers=building&access_token=${token}`;
  const body = await fetchText(url, (t) => JSON.parse(t));
  if (!body?.features) return null;
  return body.features.reduce((m, f) => Math.max(m, f.properties.height ?? 0), 0);
}

function turnAngle(a, b, c) {
  const diff = Math.abs(bearing(b, c) - bearing(a, b)) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function bearing([lng1, lat1], [lng2, lat2]) {
  const r = Math.PI / 180;
  const y = Math.sin((lng2 - lng1) * r) * Math.cos(lat2 * r);
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lng2 - lng1) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}

function haversine([lng1, lat1], [lng2, lat2]) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

function validate(fc) {
  if (fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) fail("waypoints must be a GeoJSON FeatureCollection");
  const points = fc.features.filter((f) => f.geometry?.type === "Point");
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
  if (props.speed !== undefined && props.speed !== null && (typeof props.speed !== "number" || props.speed <= 0)) fail("properties.speed must be m/s > 0");
  if (props.ramp !== undefined && (typeof props.ramp !== "number" || props.ramp < 0)) fail("properties.ramp must be milliseconds >= 0");
}

function checkLngLat([lng, lat], where) {
  if (typeof lng !== "number" || lng < -180 || lng > 180) fail(`${where}: longitude ${lng} out of range`);
  if (typeof lat !== "number" || lat < -90 || lat > 90) fail(`${where}: latitude ${lat} out of range`);
}

async function fetchText(url, parse = (t) => t) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return parse(await res.text());
  } catch {
    return null;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
