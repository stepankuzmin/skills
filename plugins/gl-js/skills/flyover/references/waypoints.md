# Waypoint format

A flight is a GeoJSON FeatureCollection. Each Point feature is one camera
position. The page smooths the path through them with a Catmull-Rom spline
and flies it with the velocity model in `assets/flyover.ts`: cruise speed on
frame one, constant speed inside a leg, smooth ramps where speed changes or
the camera stops. The build report uses the same code, so its distances and
times are the ones the page flies.

```json
{
  "type": "FeatureCollection",
  "properties": {
    "title": "Central Park",
    "speed": 45
  },
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-73.9819, 40.7681, 260] },
      "properties": { "lookAt": [-73.9712, 40.7831] }
    }
  ]
}
```

## Collection properties

| Key | Default | Meaning |
| --- | --- | --- |
| `title` | `Flyover` | Browser tab title and video file name. Nothing is drawn on the page. |
| `speed` | derived from `duration` | Cruise speed in m/s. Set this when the brief says anything about speed. |
| `duration` | `45000` | Whole flight in milliseconds. Used only when `speed` is absent. |
| `ramp` | `1500` | Milliseconds to change speed or stop. Shorter feels sharper. |
| `loop` | `false` | Restart when the flight ends. |
| `minAltitude` | `10` | Floor for camera height above ground, in meters. |

## Feature geometry

`coordinates` is `[lng, lat, altitude]`. Altitude is meters above the ground
at that point, so the same number works over Manhattan and over the Alps.

## Feature properties

| Key | Default | Meaning |
| --- | --- | --- |
| `lookAt` | ahead along the path | `[lng, lat]` or `[lng, lat, altitude]` the camera points at. Altitude is meters above ground. |
| `speed` | collection `speed` | Cruise speed in m/s for the leg leaving this waypoint. |
| `hold` | `0` | Milliseconds to stop at this waypoint. The camera decelerates into it and accelerates out over one `ramp`. |

The camera interpolates `lookAt` between waypoints too. A waypoint without
`lookAt` looks along the direction of travel at a point on the ground three
altitudes ahead, which reads as a forward-facing drone.

## Page URL

Style and token are not part of the flight. They come from the page URL,
which the build prints with the token from `MAPBOX_ACCESS_TOKEN` and any
`key=value` build arguments.

| Parameter | Default | Meaning |
| --- | --- | --- |
| `access_token` | asked for in a prompt | Mapbox access token. |
| `style` | `mapbox://styles/mapbox/standard` | Any Mapbox style URL. |
| anything else | Standard defaults | Set as a Standard config property: `lightPreset=dusk`, `theme=monochrome`, `showPointOfInterestLabels=false`. |

## Page behavior

Before frame one the page decodes Mapbox DEM tiles for every waypoint and
target, so altitudes above ground become absolute and never depend on which
terrain tiles the renderer has loaded. It then preloads every tile along the
path, waits for the map to go idle and the network to go quiet, and fades in
over 300 ms with the camera already moving. Space pauses and resumes from
the same spot. With `prefers-reduced-motion` the page shows the first frame
and waits for Space. The one button restarts the flight, records the canvas
with `MediaRecorder`, and downloads the video when the flight ends. The page
itself is a short module that reads like a GL JS example; everything hard is
a function in `assets/flyover.ts`, inlined through an import map.

## Distances

Handy conversions at the equator. Divide the longitude figure by cos(lat)
away from it.

| Meters | Degrees latitude | Degrees longitude |
| --- | --- | --- |
| 100 | 0.0009 | 0.0009 |
| 500 | 0.0045 | 0.0045 |
| 1000 | 0.009 | 0.009 |

`node scripts/orbit.ts <lng> <lat> <radius> <altitude> [points] [startBearing] [sweep]`
prints circle waypoints that all look at the center.
