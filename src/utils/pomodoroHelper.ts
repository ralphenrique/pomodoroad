import type { Location } from '../types';

const IDEAL_POMODORO_SECONDS = 25 * 60; // 25 minutes in seconds
export const MAX_AUTO_STOP_OVERS = 23; // Routes API supports up to 25 waypoints including origin/destination
const FALLBACK_SPEED_MPS = 13.4; // Approximate average driving speed for fallback calculations
const MIN_IDEAL_SEGMENT_SECONDS = 20 * 60;
const MAX_IDEAL_SEGMENT_SECONDS = 30 * 60;

function getIdealSegmentCount(totalDurationSeconds: number): number {
  if (!Number.isFinite(totalDurationSeconds) || totalDurationSeconds <= 0) {
    return 1;
  }

  const rawSegments = totalDurationSeconds / IDEAL_POMODORO_SECONDS;

  if (rawSegments < 1) {
    return 1;
  }

  const roundedSegments = Math.round(rawSegments);
  return Math.max(1, roundedSegments);
}

/**
 * Calculate suggested stopover locations along a route for ideal Pomodoro intervals
 */
export async function calculateIdealStopovers(
  origin: Location,
  destination: Location,
  apiKey: string,
  maxStopovers?: number
): Promise<Location[]> {
  try {
    // First, get the initial route without stopovers
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
  'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.polyline.encodedPolyline'
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: origin.lat,
              longitude: origin.lng
            }
          }
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.lat,
              longitude: destination.lng
            }
          }
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
        languageCode: 'en-US',
        units: 'METRIC'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to calculate route');
    }

    const data = await response.json();
    
    if (!data.routes || data.routes.length === 0) {
      return [];
    }

    const route = data.routes[0];
    const totalDuration = parseDurationSeconds(route.duration);

    const idealSegments = getIdealSegmentCount(totalDuration);
    const normalizedMaxStopovers =
      typeof maxStopovers === 'number' && Number.isFinite(maxStopovers) && maxStopovers >= 0
        ? Math.floor(maxStopovers)
        : MAX_AUTO_STOP_OVERS;
    const potentialStopovers = Math.max(idealSegments - 1, 0);
    const numberOfStopovers = Math.min(potentialStopovers, normalizedMaxStopovers);

    if (numberOfStopovers <= 0 || totalDuration <= 0) {
      return [];
    }

    const polyline = route.polyline?.encodedPolyline ? decodePolyline(route.polyline.encodedPolyline) : [];

    const distances: number[] = [0];
    let totalDistance = 0;
    for (let i = 1; i < polyline.length; i++) {
      const distance = calculateDistance(
        polyline[i - 1].lat,
        polyline[i - 1].lng,
        polyline[i].lat,
        polyline[i].lng
      );
      totalDistance += distance;
      distances.push(totalDistance);
    }

    const timePoints = buildTimePoints(route);
    const hasTimeData = timePoints.length > 1 && timePoints[timePoints.length - 1].time > 0;
    const totalDistanceMeters = distances[distances.length - 1] || 0;

    const maxSegments = Math.min(normalizedMaxStopovers + 1, MAX_AUTO_STOP_OVERS + 1);
    let evaluatedSegments = Math.min(Math.max(idealSegments, 1), maxSegments);

    let stopoverCoords: Array<{ lat: number; lng: number }> = [];

    for (let attempt = 0; attempt < 4; attempt++) {
      const stopCount = Math.max(evaluatedSegments - 1, 0);
      if (stopCount === 0) {
        stopoverCoords = [];
        break;
      }

      stopoverCoords = generateStopoverCoordinates({
        segmentCount: evaluatedSegments,
        totalDurationSeconds: totalDuration,
        totalDistanceMeters,
        polyline,
        distances,
        timePoints,
        hasTimeData
      });

      if (stopoverCoords.length < stopCount) {
        stopoverCoords = [];
        break;
      }

      const legDurations = await evaluateLegDurations(origin, destination, stopoverCoords, apiKey);
      if (!legDurations || legDurations.length === 0) {
        break;
      }

      const allWithinRange = legDurations.every((duration: number) =>
        duration >= MIN_IDEAL_SEGMENT_SECONDS && duration <= MAX_IDEAL_SEGMENT_SECONDS
      );

      if (allWithinRange) {
        break;
      }

      const hasOverMax = legDurations.some((duration: number) => duration > MAX_IDEAL_SEGMENT_SECONDS);
      if (hasOverMax && evaluatedSegments < maxSegments) {
        evaluatedSegments += 1;
        continue;
      }

      const hasUnderMin = legDurations.some((duration: number) => duration < MIN_IDEAL_SEGMENT_SECONDS);
      if (hasUnderMin && evaluatedSegments > Math.ceil(totalDuration / MAX_IDEAL_SEGMENT_SECONDS)) {
        evaluatedSegments = Math.max(evaluatedSegments - 1, 1);
        continue;
      }

      break;
    }

    if (stopoverCoords.length === 0) {
      return [];
    }

    return geocodeStopoverCoordinates(stopoverCoords, apiKey);
  } catch (error) {
    console.error('Error calculating ideal stopovers:', error);
    return [];
  }
}

/**
 * Calculate helper circle positions (same as stopovers for now)
 */
export function calculateHelperCirclePositions(
  _origin: Location,
  _destination: Location,
  polyline: google.maps.LatLng[],
  totalDuration: number
): google.maps.LatLng[] {
  const numberOfSegments = getIdealSegmentCount(totalDuration);
  const numberOfPositions = Math.min(numberOfSegments - 1, 3);
  
  if (numberOfPositions <= 0 || polyline.length === 0) {
    return [];
  }

  // Calculate cumulative distances
  const distances: number[] = [0];
  let totalDistance = 0;
  for (let i = 1; i < polyline.length; i++) {
    const distance = google.maps.geometry.spherical.computeDistanceBetween(
      polyline[i - 1],
      polyline[i]
    );
    totalDistance += distance;
    distances.push(totalDistance);
  }

  const positions: google.maps.LatLng[] = [];
  
  for (let i = 1; i <= numberOfPositions; i++) {
    const targetDistance = (totalDistance / (numberOfPositions + 1)) * i;
    
    let closestIndex = 0;
    let minDiff = Infinity;
    
    for (let j = 0; j < distances.length; j++) {
      const diff = Math.abs(distances[j] - targetDistance);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = j;
      }
    }
    
    positions.push(polyline[closestIndex]);
  }

  return positions;
}

type TimePoint = { lat: number; lng: number; time: number };

interface GenerateStopoverCoordinatesParams {
  segmentCount: number;
  totalDurationSeconds: number;
  totalDistanceMeters: number;
  polyline: Array<{ lat: number; lng: number }>;
  distances: number[];
  timePoints: TimePoint[];
  hasTimeData: boolean;
}

function generateStopoverCoordinates({
  segmentCount,
  totalDurationSeconds,
  totalDistanceMeters,
  polyline,
  distances,
  timePoints,
  hasTimeData
}: GenerateStopoverCoordinatesParams): Array<{ lat: number; lng: number }> {
  const stopCount = Math.max(segmentCount - 1, 0);
  if (stopCount === 0 || totalDurationSeconds <= 0) {
    return [];
  }

  const segmentDurationSeconds = totalDurationSeconds / segmentCount;
  const results: Array<{ lat: number; lng: number }> = [];

  for (let i = 1; i <= stopCount; i++) {
    const targetTime = segmentDurationSeconds * i;
    let point = hasTimeData ? getPointAtTime(timePoints, targetTime) : null;

    if (!point && totalDistanceMeters > 0) {
      const targetDistance = (totalDistanceMeters / segmentCount) * i;
      point = getPointAtDistance(polyline, distances, targetDistance);
    }

    if (point) {
      results.push(point);
    }
  }

  return results;
}

async function evaluateLegDurations(
  origin: Location,
  destination: Location,
  stopoverCoords: Array<{ lat: number; lng: number }>,
  apiKey: string
): Promise<number[] | null> {
  try {
    const intermediates = stopoverCoords.map(coord => ({
      location: {
        latLng: {
          latitude: coord.lat,
          longitude: coord.lng
        }
      }
    }));

    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.legs.duration'
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: origin.lat,
              longitude: origin.lng
            }
          }
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.lat,
              longitude: destination.lng
            }
          }
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
        intermediates,
        languageCode: 'en-US',
        units: 'METRIC'
      })
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const evaluationRoute = data.routes?.[0];
    const legs = evaluationRoute?.legs;
    if (!legs || legs.length === 0) {
      return null;
    }

  const durations = legs.map((leg: any) => parseDurationSeconds(leg?.duration));
  return durations.every((duration: number) => Number.isFinite(duration)) ? durations : null;
  } catch (error) {
    console.error('Error evaluating leg durations:', error);
    return null;
  }
}

async function geocodeStopoverCoordinates(
  stopoverCoords: Array<{ lat: number; lng: number }>,
  apiKey: string
): Promise<Location[]> {
  const results: Location[] = [];

  for (let index = 0; index < stopoverCoords.length; index++) {
    const point = stopoverCoords[index];

    try {
      const geocodeResponse = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${point.lat},${point.lng}&key=${apiKey}`
      );
      const geocodeData = await geocodeResponse.json();

      const address = geocodeData.results?.[0]?.formatted_address || `Stop ${index + 1} (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)})`;

      results.push({
        lat: point.lat,
        lng: point.lng,
        address
      });
    } catch (geocodeError) {
      console.error('Geocoding error:', geocodeError);
      results.push({
        lat: point.lat,
        lng: point.lng,
        address: `Stop ${index + 1} (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)})`
      });
    }
  }

  return results;
}

function parseDurationSeconds(duration?: string | null): number {
  if (!duration) {
    return 0;
  }

  const match = duration.match(/([\d.]+)s/);
  if (!match) {
    return 0;
  }

  return Math.round(parseFloat(match[1]));
}

function buildTimePoints(route: any): TimePoint[] {
  if (!route?.legs || route.legs.length === 0) {
    return [];
  }

  const points: TimePoint[] = [];
  let cumulativeTime = 0;
  let lastLat: number | null = null;
  let lastLng: number | null = null;

  const pushPoint = (lat: number, lng: number, time: number) => {
    if (lastLat === lat && lastLng === lng) {
      if (points.length > 0) {
        points[points.length - 1].time = time;
      }
      return;
    }

    points.push({ lat, lng, time });
    lastLat = lat;
    lastLng = lng;
  };

  route.legs.forEach((leg: any) => {
    leg.steps?.forEach((step: any) => {
      const encoded = step?.polyline?.encodedPolyline;
      const stepPolyline = encoded ? decodePolyline(encoded) : [];

      if (stepPolyline.length === 0) {
        const emptyDuration = parseDurationSeconds(step?.duration) || parseDurationSeconds(step?.staticDuration);
        cumulativeTime += emptyDuration;
        return;
      }

      const stepDistances: number[] = [];
      let stepTotalDistance = 0;

      for (let i = 1; i < stepPolyline.length; i++) {
        const prev = stepPolyline[i - 1];
        const curr = stepPolyline[i];
        const segmentDistance = calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
        stepTotalDistance += segmentDistance;
        stepDistances.push(segmentDistance);
      }

      const declaredDistance = typeof step?.distanceMeters === 'number' && step.distanceMeters > 0
        ? step.distanceMeters
        : stepTotalDistance;

      let stepDuration = parseDurationSeconds(step?.duration) || parseDurationSeconds(step?.staticDuration);
      if (stepDuration === 0 && declaredDistance > 0) {
        stepDuration = declaredDistance / FALLBACK_SPEED_MPS;
      }

      if (points.length === 0) {
        const firstPoint = stepPolyline[0];
        pushPoint(firstPoint.lat, firstPoint.lng, cumulativeTime);
      }

      if (stepDuration === 0 || stepTotalDistance === 0) {
        cumulativeTime += stepDuration;
        const finalPoint = stepPolyline[stepPolyline.length - 1];
        pushPoint(finalPoint.lat, finalPoint.lng, cumulativeTime);
        return;
      }

      for (let i = 1; i < stepPolyline.length; i++) {
        const segmentDistance = stepDistances[i - 1];
        const fraction = segmentDistance / stepTotalDistance;
        const deltaTime = stepDuration * fraction;
        cumulativeTime += deltaTime;
        const point = stepPolyline[i];
        pushPoint(point.lat, point.lng, cumulativeTime);
      }
    });
  });

  if (points.length > 0) {
    points[0].time = 0;
  }

  return points;
}

function getPointAtTime(points: TimePoint[], targetTime: number): { lat: number; lng: number } | null {
  if (points.length === 0) {
    return null;
  }

  if (targetTime <= points[0].time) {
    return { lat: points[0].lat, lng: points[0].lng };
  }

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1];
    const current = points[i];
    if (targetTime <= current.time) {
      const interval = current.time - previous.time;
      if (interval <= 0) {
        return { lat: current.lat, lng: current.lng };
      }

      const ratio = Math.min(Math.max((targetTime - previous.time) / interval, 0), 1);
      return {
        lat: previous.lat + (current.lat - previous.lat) * ratio,
        lng: previous.lng + (current.lng - previous.lng) * ratio
      };
    }
  }

  const finalPoint = points[points.length - 1];
  return { lat: finalPoint.lat, lng: finalPoint.lng };
}

function getPointAtDistance(
  polyline: Array<{ lat: number; lng: number }>,
  distances: number[],
  targetDistance: number
): { lat: number; lng: number } | null {
  if (polyline.length === 0) {
    return null;
  }

  if (targetDistance <= 0 || distances.length === 0) {
    return polyline[0];
  }

  for (let i = 1; i < distances.length; i++) {
    if (targetDistance <= distances[i]) {
      const segmentStartDistance = distances[i - 1];
      const segmentEndDistance = distances[i];
      const span = segmentEndDistance - segmentStartDistance;
      const ratio = span > 0 ? (targetDistance - segmentStartDistance) / span : 0;
      const startPoint = polyline[i - 1];
      const endPoint = polyline[i];
      return {
        lat: startPoint.lat + (endPoint.lat - startPoint.lat) * ratio,
        lng: startPoint.lng + (endPoint.lng - startPoint.lng) * ratio
      };
    }
  }

  return polyline[polyline.length - 1];
}

// Helper function to decode polyline
function decodePolyline(encoded: string): Array<{lat: number, lng: number}> {
  const poly: Array<{lat: number, lng: number}> = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    poly.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return poly;
}

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
