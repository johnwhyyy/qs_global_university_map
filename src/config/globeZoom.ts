export const GLOBE_MIN_ZOOM = 1;
export const GLOBE_MAX_ZOOM = 20;
export const GLOBE_MIN_ALTITUDE = 0.08;
export const GLOBE_MAX_ALTITUDE = 4.2;
export const GLOBE_RADIUS = 100;

export const GLOBE_ZOOM = {
  min: GLOBE_MIN_ZOOM,
  max: GLOBE_MAX_ZOOM,
  minAltitude: GLOBE_MIN_ALTITUDE,
  maxAltitude: GLOBE_MAX_ALTITUDE,
  sliderStep: 0.1,
  minCameraDistance: GLOBE_RADIUS * (1 + GLOBE_MIN_ALTITUDE),
  maxCameraDistance: GLOBE_RADIUS * (1 + GLOBE_MAX_ALTITUDE)
} as const;
