// Timing model shared by the page and the build report.
//
// A flight is legs between consecutive waypoints. Each leg cruises at one
// speed. Speed changes and stops happen inside short ramps with a smoothstep
// velocity profile, so the camera never jerks. The flight is already at
// cruise speed on frame one.
const S = (u) => u * u * u - (u * u * u * u) / 2; // integral of smoothstep on [0, u]

// waypoints: [{ d: meters along the path, hold: ms, speed: m/s or null }]
// opts: { duration: ms, speed: m/s or null, ramp: ms }
export function planFlight(waypoints, opts) {
  const n = waypoints.length;
  const total = waypoints[n - 1].d;
  const stopAt = (i) => i === n - 1 || waypoints[i].hold > 0;
  const holds = waypoints.reduce((a, w) => a + (w.hold || 0), 0);

  let cruise = opts.speed;
  if (!cruise) {
    let rampTime = 0;
    for (let i = 0; i < n - 1; i++) {
      if (i > 0 && stopAt(i)) rampTime += opts.ramp / 2;
      if (stopAt(i + 1)) rampTime += opts.ramp / 2;
    }
    const travel = opts.duration - holds - rampTime;
    cruise = total / (travel > 0 ? travel : opts.duration / 2) * 1000;
  }

  const legs = [];
  for (let i = 0; i < n - 1; i++) {
    const vc = waypoints[i].speed || cruise;
    const startsAtStop = i > 0 ? stopAt(i) : waypoints[0].hold > 0;
    const vs = startsAtStop ? 0 : vc;
    const ve = stopAt(i + 1) ? 0 : (waypoints[i + 1].speed || cruise);
    let ta = startsAtStop ? opts.ramp : 0;
    let td = ve !== vc ? opts.ramp : 0;
    const D = waypoints[i + 1].d - waypoints[i].d;
    let T = 0;
    for (let k = 0; k < 4; k++) {
      T = (D + ((vc - vs) * ta) / 2000 + ((vc - ve) * td) / 2000) / vc * 1000;
      if (ta + td <= T) break;
      const shrink = T / (ta + td);
      ta *= shrink;
      td *= shrink;
    }
    legs.push({ i, from: waypoints[i].d, D, T, ta, td, vs, vc, ve });
  }

  const phases = [];
  let clock = 0;
  for (let i = 0; i < n; i++) {
    if (waypoints[i].hold > 0) {
      phases.push({ type: "hold", start: clock, end: clock + waypoints[i].hold, d: waypoints[i].d, i });
      clock += waypoints[i].hold;
    }
    if (i < n - 1) {
      phases.push(Object.assign({ type: "leg", start: clock, end: clock + legs[i].T }, legs[i]));
      clock += legs[i].T;
    }
  }
  return { legs, phases, total: clock, cruise, distance: total };
}

// Meters along the path at time ms into the flight.
export function distanceAt(plan, time) {
  const p = plan.phases.find((ph) => time < ph.end) || plan.phases[plan.phases.length - 1];
  if (p.type === "hold") return { d: p.d, i: p.i };
  const t = Math.min(Math.max(time - p.start, 0), p.T);
  const { ta, td, vs, vc, ve, T } = p;
  const dA = (vs * ta + ((vc - vs) * ta) / 2) / 1000;
  let d;
  if (t < ta) d = (vs * t + (vc - vs) * ta * S(t / ta)) / 1000;
  else if (t < T - td) d = dA + (vc * (t - ta)) / 1000;
  else {
    const tau = t - (T - td);
    d = dA + (vc * (T - ta - td)) / 1000 + (vc * tau + (ve - vc) * td * S(tau / td)) / 1000;
  }
  return { d: p.from + d, i: p.i };
}
