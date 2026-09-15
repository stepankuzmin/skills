// Everything a generated flyover page needs. The first half is pure math
// shared with the build report; the second half touches the map, the
// network, and the clock. Imports cleanly in Node: nothing runs at load.

declare const mapboxgl: any;

export type LngLat = [number, number];

export interface WaypointProperties {
  lookAt?: number[];
  hold?: number;
  speed?: number;
}

export interface FlightProperties {
  title?: string;
  speed?: number;
  duration?: number;
  ramp?: number;
  loop?: boolean;
  minAltitude?: number;
}

export interface Waypoint {
  type: "Feature";
  geometry: { type: "Point"; coordinates: number[] };
  properties?: WaypointProperties;
}

export interface FlightCollection {
  type: "FeatureCollection";
  properties?: FlightProperties;
  features: Waypoint[];
}

export const defaults = { duration: 45000, ramp: 1500, loop: false, minAltitude: 10 };
export type FlightOptions = typeof defaults & FlightProperties;

export interface Pose {
  lngLat: LngLat;
  altitude: number;
  pitch: number;
  bearing: number;
}

export interface Flight {
  options: FlightOptions;
  plan: Plan;
  samples: Sample[];
}

type Vec3 = [number, number, number]; // mercator x, mercator y, meters
interface Sample { pos: Vec3; look: Vec3; d: number }

const EARTH = 40030228.88;
const rad = Math.PI / 180;
const SAMPLES = 64;

export function mercator([lng, lat]: LngLat): [number, number] {
  return [(180 + lng) / 360, (180 - Math.log(Math.tan(Math.PI / 4 + (lat * rad) / 2)) / rad) / 360];
}

export function lngLatOf([x, y]: [number, number]): LngLat {
  return [x * 360 - 180, (Math.atan(Math.exp((180 - y * 360) * rad)) / rad) * 2 - 90];
}

const metersPerUnit = (lat: number) => EARTH * Math.cos(lat * rad);

// groundAt returns ground elevation in meters, so altitudes above ground
// become absolute. The build passes nothing and reports altitudes as given.
export async function compileFlight(
  fc: FlightCollection,
  groundAt: (p: LngLat) => Promise<number> | number = () => 0,
): Promise<Flight> {
  const options: FlightOptions = { ...defaults, ...fc.properties };
  const points = fc.features.filter((f) => f.geometry.type === "Point");
  const meanLat = points.reduce((a, f) => a + f.geometry.coordinates[1], 0) / points.length;
  const scale = metersPerUnit(meanLat);

  const nodes = await Promise.all(points.map(async (f, i) => {
    const [lng, lat, agl = 100] = f.geometry.coordinates;
    const p = f.properties ?? {};
    const here: LngLat = [lng, lat];
    const lookLngLat: LngLat = p.lookAt ? [p.lookAt[0], p.lookAt[1]] : ahead(points, i, agl * 3, scale);
    const [ground, lookGround] = await Promise.all([groundAt(here), groundAt(lookLngLat)]);
    return {
      pos: [...mercator(here), Math.max(agl, options.minAltitude) + ground] as Vec3,
      look: [...mercator(lookLngLat), (p.lookAt?.[2] ?? 0) + lookGround] as Vec3,
      hold: p.hold ?? 0,
      speed: p.speed,
    };
  }));

  const samples = samplePath(nodes, scale);
  const plan = planFlight(nodes.map((n, i) => ({ d: samples[i * SAMPLES].d, hold: n.hold, speed: n.speed })), options);
  return { options, plan, samples };
}

export function poseAt(flight: Flight, time: number): Pose {
  const { pos, look } = sampleAt(flight.samples, distanceAt(flight.plan, time));
  const lngLat = lngLatOf([pos[0], pos[1]]);
  const dx = look[0] - pos[0];
  const dy = look[1] - pos[1];
  const dz = (look[2] - pos[2]) / metersPerUnit(lngLat[1]);
  return {
    lngLat,
    altitude: pos[2],
    pitch: Math.min(Math.atan2(Math.hypot(dx, dy), -dz) / rad, 85),
    bearing: Math.atan2(dx, -dy) / rad,
  };
}

// A point `meters` ahead of waypoint i along the direction from its
// neighbors, so a waypoint without lookAt reads as a forward-facing drone.
function ahead(points: Waypoint[], i: number, meters: number, scale: number): LngLat {
  const at = (k: number) => mercator(points[Math.max(0, Math.min(points.length - 1, k))].geometry.coordinates as unknown as LngLat);
  const [hx, hy] = at(i);
  const [ax, ay] = at(i - 1);
  const [bx, by] = at(i + 1);
  const len = Math.hypot(bx - ax, by - ay) || 1e-9;
  const step = meters / scale / len;
  return lngLatOf([hx + (bx - ax) * step, hy + (by - ay) * step]);
}

function catmullRom(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const t2 = t * t;
  const t3 = t2 * t;
  return p1.map((_, i) => 0.5 * (
    2 * p1[i] +
    (-p0[i] + p2[i]) * t +
    (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 +
    (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3)) as Vec3;
}

function samplePath(nodes: { pos: Vec3; look: Vec3 }[], scale: number): Sample[] {
  const n = (i: number) => nodes[Math.max(0, Math.min(nodes.length - 1, i))];
  const samples: Sample[] = [];
  let d = 0;
  for (let s = 0; s < nodes.length - 1; s++) {
    for (let k = 0; k < SAMPLES; k++) {
      const t = k / SAMPLES;
      const pos = catmullRom(n(s - 1).pos, n(s).pos, n(s + 1).pos, n(s + 2).pos, t);
      const look = catmullRom(n(s - 1).look, n(s).look, n(s + 1).look, n(s + 2).look, t);
      const prev = samples.at(-1);
      if (prev) d += Math.hypot(pos[0] - prev.pos[0], pos[1] - prev.pos[1]) * scale;
      samples.push({ pos, look, d });
    }
  }
  const last = nodes[nodes.length - 1];
  const prev = samples[samples.length - 1];
  d += Math.hypot(last.pos[0] - prev.pos[0], last.pos[1] - prev.pos[1]) * scale;
  samples.push({ pos: last.pos, look: last.look, d });
  return samples;
}

function sampleAt(samples: Sample[], d: number): { pos: Vec3; look: Vec3 } {
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].d < d) lo = mid + 1; else hi = mid;
  }
  const b = samples[Math.max(lo, 1)];
  const a = samples[Math.max(lo - 1, 0)];
  const t = Math.max(0, Math.min(1, (d - a.d) / (b.d - a.d || 1)));
  const lerp = (u: Vec3, v: Vec3) => u.map((x, i) => x + (v[i] - x) * t) as Vec3;
  return { pos: lerp(a.pos, b.pos), look: lerp(a.look, b.look) };
}

// Timing. A flight is legs between consecutive waypoints. Each leg cruises
// at one speed; speed changes and stops happen inside short ramps with a
// smoothstep velocity profile. The flight is at cruise speed on frame one.

export interface Leg {
  from: number; // meters along the path
  D: number; // leg length, meters
  T: number; // leg time, ms
  ta: number; // acceleration ramp, ms
  td: number; // deceleration ramp, ms
  vs: number; // speed at start, m/s
  vc: number; // cruise speed, m/s
  ve: number; // speed at end, m/s
}

type Phase =
  | { type: "hold"; start: number; end: number; d: number }
  | ({ type: "leg"; start: number; end: number } & Leg);

export interface Plan {
  phases: Phase[];
  total: number; // ms
  cruise: number; // m/s
  distance: number; // meters
}

interface PlanNode { d: number; hold: number; speed?: number }

const S = (u: number) => u * u * u - (u * u * u * u) / 2; // integral of smoothstep on [0, u]

export function planFlight(nodes: PlanNode[], opts: { duration: number; speed?: number; ramp: number }): Plan {
  const n = nodes.length;
  const distance = nodes[n - 1].d;
  const stopAt = (i: number) => i === n - 1 || nodes[i].hold > 0;
  const holds = nodes.reduce((a, w) => a + w.hold, 0);

  let cruise = opts.speed;
  if (!cruise) {
    let rampTime = 0;
    for (let i = 0; i < n - 1; i++) {
      if (i > 0 && stopAt(i)) rampTime += opts.ramp / 2;
      if (stopAt(i + 1)) rampTime += opts.ramp / 2;
    }
    const travel = opts.duration - holds - rampTime;
    cruise = (distance / (travel > 0 ? travel : opts.duration / 2)) * 1000;
  }

  const legs: Leg[] = [];
  for (let i = 0; i < n - 1; i++) {
    const vc = nodes[i].speed || cruise;
    const startsAtStop = stopAt(i);
    const vs = startsAtStop ? 0 : vc;
    const ve = stopAt(i + 1) ? 0 : nodes[i + 1].speed || cruise;
    let ta = startsAtStop ? opts.ramp : 0;
    let td = ve !== vc ? opts.ramp : 0;
    const D = nodes[i + 1].d - nodes[i].d;
    let T = 0;
    for (let k = 0; k < 4; k++) {
      T = ((D + ((vc - vs) * ta) / 2000 + ((vc - ve) * td) / 2000) / vc) * 1000;
      if (ta + td <= T) break;
      const shrink = T / (ta + td);
      ta *= shrink;
      td *= shrink;
    }
    legs.push({ from: nodes[i].d, D, T, ta, td, vs, vc, ve });
  }

  const phases: Phase[] = [];
  let clock = 0;
  for (let i = 0; i < n; i++) {
    if (nodes[i].hold > 0) {
      phases.push({ type: "hold", start: clock, end: clock + nodes[i].hold, d: nodes[i].d });
      clock += nodes[i].hold;
    }
    if (i < n - 1) {
      phases.push({ type: "leg", start: clock, end: clock + legs[i].T, ...legs[i] });
      clock += legs[i].T;
    }
  }
  return { phases, total: clock, cruise, distance };
}

// Meters along the path at `time` ms into the flight.
export function distanceAt(plan: Plan, time: number): number {
  const p = plan.phases.find((ph) => time < ph.end) ?? plan.phases[plan.phases.length - 1];
  if (p.type === "hold") return p.d;
  if (p.T <= 0) return p.from;
  const t = Math.min(Math.max(time - p.start, 0), p.T);
  const { ta, td, vs, vc, ve, T } = p;
  const dA = (vs * ta + ((vc - vs) * ta) / 2) / 1000;
  if (t < ta) return p.from + (vs * t + (vc - vs) * ta * S(t / ta)) / 1000;
  if (t < T - td) return p.from + dA + (vc * (t - ta)) / 1000;
  const tau = t - (T - td);
  return p.from + dA + (vc * (T - ta - td)) / 1000 + (vc * tau + (ve - vc) * td * S(tau / td)) / 1000;
}

// Ground elevation from Mapbox DEM tiles, decoded here so altitudes are
// absolute before frame one instead of following whichever terrain tiles the
// renderer has loaded. Returns 0 when a tile cannot be fetched.
export function groundElevation(token: string, zoom = 13) {
  const tiles = new Map<string, Promise<{ ctx: CanvasRenderingContext2D; size: number } | null>>();
  return async ([lng, lat]: LngLat): Promise<number> => {
    const n = 2 ** zoom;
    const [x, y] = mercator([lng, lat]).map((v) => v * n);
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    const key = `${tx}/${ty}`;
    if (!tiles.has(key)) {
      tiles.set(key, fetch(`https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/${zoom}/${tx}/${ty}.pngraw?access_token=${token}`)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then(createImageBitmap)
        .then((bmp) => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = bmp.width;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(bmp, 0, 0);
          return { ctx, size: bmp.width };
        })
        .catch(() => null));
    }
    const tile = await tiles.get(key);
    if (!tile) return 0;
    const [r, g, b] = tile.ctx.getImageData(Math.floor((x - tx) * tile.size), Math.floor((y - ty) * tile.size), 1, 1).data;
    return Math.max(0, -10000 + (r * 65536 + g * 256 + b) * 0.1);
  };
}

// Standard style config from the page URL: every query parameter except the
// reserved ones becomes a basemap property, so ?lightPreset=dusk works.
export function configureBasemap(map: any, params: URLSearchParams) {
  for (const [key, value] of params) {
    if (key === "access_token" || key === "style") continue;
    const parsed = value === "true" ? true : value === "false" ? false : value !== "" && !Number.isNaN(Number(value)) ? Number(value) : value;
    try {
      map.setConfigProperty("basemap", key, parsed);
    } catch (e) {
      console.warn(`basemap ${key}:`, e);
    }
  }
}

export function setCamera(map: any, pose: Pose) {
  const camera = new mapboxgl.FreeCameraOptions(mapboxgl.MercatorCoordinate.fromLngLat(pose.lngLat, pose.altitude));
  camera.setPitchBearing(pose.pitch, pose.bearing);
  map.setFreeCameraOptions(camera);
}

// Ask the renderer for every tile the flight will need, then wait until the
// network and the map go quiet. One _preloadTiles call dedupes tiles across
// all sampled camera states; jumpTo({ preloadOnly }) per state would reload
// each tile once per call. Resolves with the camera on frame one.
export async function preload(map: any, flight: Flight) {
  setCamera(map, poseAt(flight, 0));
  await idle(map);
  if (typeof map._preloadTiles === "function") {
    const step = Math.max(1000, flight.plan.total / 120);
    const transforms = [];
    for (let t = 0; t <= flight.plan.total; t += step) {
      const tr = map.transform.clone();
      const { lngLat, altitude, pitch, bearing } = poseAt(flight, t);
      const camera = new mapboxgl.FreeCameraOptions(mapboxgl.MercatorCoordinate.fromLngLat(lngLat, altitude));
      camera.setPitchBearing(pitch, bearing);
      tr.setFreeCameraOptions(camera);
      transforms.push(tr);
    }
    map._preloadTiles(transforms);
    await networkQuiet(1500, 15000);
  }
  await idle(map);
  setCamera(map, poseAt(flight, 0));
}

function idle(map: any, maxMs = 10000) {
  return Promise.race([
    new Promise<void>((resolve) => { map.once("idle", resolve); map.triggerRepaint(); }),
    new Promise<void>((resolve) => setTimeout(resolve, maxMs)),
  ]);
}

function networkQuiet(quietMs: number, maxMs: number) {
  return new Promise<void>((resolve) => {
    const t0 = performance.now();
    let last = t0;
    const observer = new PerformanceObserver(() => { last = performance.now(); });
    observer.observe({ type: "resource" });
    const check = () => {
      const now = performance.now();
      if (now - last > quietMs || now - t0 > maxMs) { observer.disconnect(); resolve(); }
      else setTimeout(check, 200);
    };
    check();
  });
}

export interface Player {
  toggle(): void; // pause, or resume from the same spot
  restart(): Promise<void>; // from frame one; resolves when the flight reaches its end
}

// Drives the camera along the flight with requestAnimationFrame. Honors
// prefers-reduced-motion by showing frame one and waiting for toggle().
export function play(map: any, flight: Flight): Player {
  const total = flight.plan.total;
  let startedAt: number | null = null;
  let pausedAt: number | null = null;
  let raf = 0;
  let onEnd: (() => void)[] = [];

  function frame(now: number) {
    startedAt ??= now;
    let t = now - startedAt;
    if (t >= total) {
      onEnd.splice(0).forEach((f) => f());
      startedAt = flight.options.loop ? now : null;
      if (!flight.options.loop) return setCamera(map, poseAt(flight, total));
      t = 0;
    }
    setCamera(map, poseAt(flight, t));
    raf = requestAnimationFrame(frame);
  }
  const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); };

  setCamera(map, poseAt(flight, 0));
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) pausedAt = performance.now();
  else run();

  return {
    toggle() {
      if (pausedAt === null) {
        pausedAt = performance.now();
        cancelAnimationFrame(raf);
      } else {
        if (startedAt !== null) startedAt += performance.now() - pausedAt;
        pausedAt = null;
        run();
      }
    },
    restart() {
      startedAt = null;
      pausedAt = null;
      run();
      return new Promise<void>((resolve) => onEnd.push(resolve));
    },
  };
}

// Records one pass of the flight from the map canvas and downloads it. The
// map needs preserveDrawingBuffer: true for the canvas to be capturable.
export async function record(map: any, player: Player, filename = document.title) {
  const type = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) throw new Error("MediaRecorder cannot encode video in this browser");
  const recorder = new MediaRecorder(map.getCanvas().captureStream(), { mimeType: type, videoBitsPerSecond: 16e6 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => chunks.push(e.data);
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
  recorder.start();
  await player.restart();
  await new Promise((resolve) => setTimeout(resolve, 300));
  recorder.stop();
  await stopped;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(chunks, { type }));
  a.download = `${filename}.${type.startsWith("video/mp4") ? "mp4" : "webm"}`;
  a.click();
}
