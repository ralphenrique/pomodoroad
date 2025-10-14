import { useEffect, useRef, useState } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import type { Location, RouteData } from '../types';

interface RouteRendererProps {
    origin: Location | null;
    destination: Location | null;
    onRouteCalculated: (routeData: RouteData) => void;
    progress: number;
    apiKey: string;
    autoCenterOnMarker?: boolean;
    stopovers?: Location[];
    onStopoverPositionsCalculated?: (positions: number[]) => void;
    onUserInteraction?: () => void;
    showHelperCircles?: boolean;
    helperCirclePositions?: google.maps.LatLng[];
}

const DEFAULT_SPEED_MPS = 13.4;
const SPEED_LIMITS_ENABLED = false;
const MAX_SPEED_LIMIT_POINTS_PER_REQUEST = 90;
const MPS_PER_KPH = 1000 / 3600;
const MPS_PER_MPH = 1609.34 / 3600;
type SimpleLatLng = { lat: number; lng: number };
type SpeedSegment = {
    startDistance: number;
    endDistance: number;
    duration: number;
    speed: number;
};

// Decode polyline string to array of LatLng coordinates
function decodePolyline(encoded: string): google.maps.LatLng[] {
    const poly: google.maps.LatLng[] = [];
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

        poly.push(new google.maps.LatLng(lat / 1e5, lng / 1e5));
    }
    return poly;
}

export default function RouteRenderer({
    origin,
    destination,
    onRouteCalculated,
    progress,
    apiKey,
    autoCenterOnMarker,
    stopovers = [],
    onStopoverPositionsCalculated,
    onUserInteraction,
    showHelperCircles = false,
    helperCirclePositions = []
}: RouteRendererProps) {
    const map = useMap();
    const polylineRef = useRef<google.maps.Polyline | null>(null);
    const originMarkerRef = useRef<google.maps.Marker | null>(null);
    const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
    const progressMarkerRef = useRef<google.maps.Marker | null>(null);
    const stopoverMarkersRef = useRef<google.maps.Marker[]>([]);
    const helperCirclesRef = useRef<google.maps.Circle[]>([]);
    const [routePath, setRoutePath] = useState<google.maps.LatLng[]>([]);
    const [cumulativeDistances, setCumulativeDistances] = useState<number[]>([]);
    const [speedSegments, setSpeedSegments] = useState<SpeedSegment[]>([]);
    const [legDurations, setLegDurations] = useState<number[]>([]);
    const [totalRouteDuration, setTotalRouteDuration] = useState<number>(0);
    const animationFrameRef = useRef<number | null>(null);
    const startProgressRef = useRef<number>(0);
    const targetProgressRef = useRef<number>(0);
    const animationStartTimeRef = useRef<number>(0);
    const [currentMarkerPosition, setCurrentMarkerPosition] = useState<google.maps.LatLng | null>(null);
    const prevAutoCenterRef = useRef<boolean>(false);
    const autoCenterStartTimeRef = useRef<number>(0);
    const autoCenterActiveRef = useRef<boolean>(!!autoCenterOnMarker);
    const currentHeadingRef = useRef<number>(0);

    useEffect(() => {
        autoCenterActiveRef.current = !!autoCenterOnMarker;
    }, [autoCenterOnMarker]);

    // Auto-center on marker when enabled - keep marker centered during movement
    useEffect(() => {
        if (!map || !currentMarkerPosition) return;

        // Detect when auto-center is toggled on
        if (autoCenterOnMarker && !prevAutoCenterRef.current) {
            // Just enabled - set zoom and center immediately without panning
            map.setZoom(17);
            map.setCenter(currentMarkerPosition);
            map.setHeading(currentHeadingRef.current);
            map.setTilt(60);
            autoCenterStartTimeRef.current = Date.now();
            prevAutoCenterRef.current = true;
            autoCenterActiveRef.current = true;
            return;
        }

        // Track when auto-center is toggled off
        if (!autoCenterOnMarker && prevAutoCenterRef.current) {
            prevAutoCenterRef.current = false;
            autoCenterActiveRef.current = false;
            map.setTilt(0);
            map.setHeading(0);
            return;
        }

        // Continue centering if auto-center is active - instant center, no panning
        if (autoCenterOnMarker) {
            map.setCenter(currentMarkerPosition);
            map.setHeading(currentHeadingRef.current);
            if (map.getTilt() !== 60) {
                map.setTilt(60);
            }
        }
    }, [currentMarkerPosition, map, autoCenterOnMarker]);

    // Disable auto-center when the user manually interacts with the map
    useEffect(() => {
        if (!map || !onUserInteraction) return;

        const handleInteraction = () => {
            if (!autoCenterActiveRef.current) return;
            autoCenterActiveRef.current = false;
            map.setTilt(0);
            map.setHeading(0);
            onUserInteraction();
        };

        const listeners = [
            map.addListener('dragstart', handleInteraction)
        ];

        const mapDiv = map.getDiv() as HTMLElement | null;
        if (mapDiv) {
            mapDiv.addEventListener('wheel', handleInteraction, { passive: true });
            mapDiv.addEventListener('touchstart', handleInteraction, { passive: true });
            mapDiv.addEventListener('dblclick', handleInteraction);
        }

        return () => {
            listeners.forEach(listener => listener.remove());
            if (mapDiv) {
                mapDiv.removeEventListener('wheel', handleInteraction);
                mapDiv.removeEventListener('touchstart', handleInteraction);
                mapDiv.removeEventListener('dblclick', handleInteraction);
            }
        };
    }, [map, onUserInteraction]);

    // Calculate stopover positions along the route and create markers
    useEffect(() => {
        if (!map || routePath.length === 0 || cumulativeDistances.length === 0 || stopovers.length === 0) {
            // Clear stopover markers if no stopovers
            stopoverMarkersRef.current.forEach(marker => marker.setMap(null));
            stopoverMarkersRef.current = [];

            if (onStopoverPositionsCalculated) {
                onStopoverPositionsCalculated([]);
            }
            return;
        }

        // Remove existing stopover markers
        stopoverMarkersRef.current.forEach(marker => marker.setMap(null));
        stopoverMarkersRef.current = [];

        const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];
        const distancePositions: number[] = [];

        // Create new stopover markers and calculate their positions
        stopovers.forEach((stopover, index) => {
            if (stopover.lat === 0 && stopover.lng === 0) {
                distancePositions.push(0);
                return; // Skip unset stopovers
            }

            const stopoverLatLng = new google.maps.LatLng(stopover.lat, stopover.lng);
            
            // Find the closest point on the route to this stopover
            // Since stopovers are now waypoints, they should be very close to the route
            let minDistance = Infinity;
            let closestIndex = 0;
            
            routePath.forEach((point, idx) => {
                const distance = google.maps.geometry.spherical.computeDistanceBetween(
                    stopoverLatLng,
                    point
                );
                if (distance < minDistance) {
                    minDistance = distance;
                    closestIndex = idx;
                }
            });

            // Calculate the position as a percentage of total distance
            const distanceToStopover = cumulativeDistances[closestIndex];
            const positionPercentage = totalDistance > 0 ? distanceToStopover / totalDistance : 0;
            distancePositions.push(positionPercentage);

            const marker = new google.maps.Marker({
                map,
                position: new google.maps.LatLng(stopover.lat, stopover.lng),
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#FBBF24',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2
                },
                label: {
                    text: `${index + 1}`,
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 'bold'
                },
                zIndex: 500
            });

            stopoverMarkersRef.current.push(marker);
        });

        // Calculate stopover positions using actual leg durations for timer accuracy
        const timePositions: number[] = [];
        if (totalRouteDuration > 0 && legDurations.length > 0) {
            let cumulativeDuration = 0;

            stopovers.forEach((stopover, index) => {
                if (stopover.lat === 0 && stopover.lng === 0) {
                    timePositions.push(0);
                    return;
                }

                const legDuration = legDurations[index] ?? 0;
                cumulativeDuration += legDuration;

                const ratio = totalRouteDuration > 0 ? cumulativeDuration / totalRouteDuration : 0;
                const clampedRatio = Math.min(Math.max(ratio, 0), 1);
                timePositions.push(clampedRatio);
            });
        }

        const hasCompleteTimePositions = totalRouteDuration > 0 &&
            legDurations.length >= stopovers.length &&
            timePositions.length === stopovers.length &&
            timePositions.every(value => Number.isFinite(value) && value >= 0 && value <= 1);

        // Notify parent of calculated positions
        if (onStopoverPositionsCalculated) {
            onStopoverPositionsCalculated(hasCompleteTimePositions ? timePositions : distancePositions);
        }
    }, [map, stopovers, routePath, cumulativeDistances, legDurations, totalRouteDuration, onStopoverPositionsCalculated]);

    // Initialize markers and polyline
    useEffect(() => {
        if (!map) return;

        // Initialize polyline for route
        polylineRef.current = new google.maps.Polyline({
            map,
            strokeColor: '#3B82F6',
            strokeWeight: 5,
            strokeOpacity: 0.8,
            geodesic: true
        });

        // Initialize origin marker
        originMarkerRef.current = new google.maps.Marker({
            map,
            visible: false,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#10B981',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2
            },
            label: {
                text: 'A',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 'bold'
            }
        });

        // Initialize destination marker
        destinationMarkerRef.current = new google.maps.Marker({
            map,
            visible: false,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#EF4444',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2
            },
            label: {
                text: 'B',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 'bold'
            }
        });

        // Initialize progress marker
        progressMarkerRef.current = new google.maps.Marker({
            map,
            visible: false,
            icon: {
                path: 'M 0,-2 L -1.5,2 L 0,1 L 1.5,2 Z',
                fillColor: '#F59E0B',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: 3,
                anchor: new google.maps.Point(0, 0),
                rotation: 0
            },
            zIndex: 1000,
            // Enable smooth animation
            optimized: false
        });

        return () => {
            polylineRef.current?.setMap(null);
            originMarkerRef.current?.setMap(null);
            destinationMarkerRef.current?.setMap(null);
            progressMarkerRef.current?.setMap(null);
            stopoverMarkersRef.current.forEach(marker => marker.setMap(null));
            helperCirclesRef.current.forEach(circle => circle.setMap(null));

            // Cancel any ongoing animation
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [map]);

    // Draw helper circles at suggested stopover positions
    useEffect(() => {
        if (!map || !showHelperCircles) {
            // Clear helper circles
            helperCirclesRef.current.forEach(circle => circle.setMap(null));
            helperCirclesRef.current = [];
            return;
        }

        // Clear existing helper circles
        helperCirclesRef.current.forEach(circle => circle.setMap(null));
        helperCirclesRef.current = [];

        // Create new helper circles
        helperCirclePositions.forEach((position) => {
            const circle = new google.maps.Circle({
                map,
                center: position,
                radius: 500, // 500 meters radius
                strokeColor: '#3B82F6',
                strokeOpacity: 0.6,
                strokeWeight: 2,
                fillColor: '#3B82F6',
                fillOpacity: 0.1,
                clickable: false,
                zIndex: 100
            });
            helperCirclesRef.current.push(circle);
        });

        return () => {
            helperCirclesRef.current.forEach(circle => circle.setMap(null));
        };
    }, [map, showHelperCircles, helperCirclePositions]);

    // Calculate route using Routes API when origin and destination change
    useEffect(() => {
        if (!origin || !destination || !map) {
            // Clear route and markers when origin or destination is null
            polylineRef.current?.setPath([]);
            originMarkerRef.current?.setVisible(false);
            destinationMarkerRef.current?.setVisible(false);
            progressMarkerRef.current?.setVisible(false);
            setRoutePath([]);
            setCumulativeDistances([]);
            setSpeedSegments([]);
            setLegDurations([]);
            setTotalRouteDuration(0);
            map?.setTilt(0);
            map?.setHeading(0);

            return;
        }

        const computeRoute = async () => {
            try {
                // Build intermediates array from stopovers
                const intermediates = stopovers
                    .filter(stopover => stopover.lat !== 0 && stopover.lng !== 0)
                    .map(stopover => ({
                        location: {
                            latLng: {
                                latitude: stopover.lat,
                                longitude: stopover.lng
                            }
                        }
                    }));

                const requestBody: any = {
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
                    computeAlternativeRoutes: false,
                    languageCode: 'en-US',
                    units: 'METRIC'
                };

                // Add intermediates if there are valid stopovers
                if (intermediates.length > 0) {
                    requestBody.intermediates = intermediates;
                }

                const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': apiKey,
                        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters,routes.legs.startLocation,routes.legs.endLocation,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.polyline'
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    throw new Error(`Routes API error: ${response.statusText}`);
                }

                const data = await response.json();

                if (data.routes && data.routes.length > 0) {
                    const route = data.routes[0];

                    // Decode polyline
                    const encodedPolyline = route.polyline.encodedPolyline;
                    const path = decodePolyline(encodedPolyline);
                    setRoutePath(path);

                    const simplePath = path.map(point => ({ lat: point.lat(), lng: point.lng() }));
                    let speedLimitSamples: number[] = [];
                    if (simplePath.length > 1) {
                        try {
                            speedLimitSamples = await fetchSpeedLimitsForRoute(simplePath);
                        } catch (speedLimitError) {
                            console.error('Error fetching speed limits:', speedLimitError);
                        }
                    }

                    // Calculate cumulative distances for constant speed movement
                    const distances: number[] = [0];
                    let totalDistance = 0;
                    for (let i = 1; i < path.length; i++) {
                        const distance = google.maps.geometry.spherical.computeDistanceBetween(
                            path[i - 1],
                            path[i]
                        );
                        totalDistance += distance;
                        distances.push(totalDistance);
                    }
                    setCumulativeDistances(distances);

                    // Draw the route
                    polylineRef.current?.setPath(path);

                    // Set markers
                    originMarkerRef.current?.setPosition(new google.maps.LatLng(origin.lat, origin.lng));
                    originMarkerRef.current?.setVisible(true);

                    destinationMarkerRef.current?.setPosition(new google.maps.LatLng(destination.lat, destination.lng));
                    destinationMarkerRef.current?.setVisible(true);

                    // Fit bounds to show entire route
                    const bounds = new google.maps.LatLngBounds();
                    path.forEach(point => bounds.extend(point));
                    map.fitBounds(bounds, 100);

                    // Parse duration (format: "1234s" -> 1234 seconds)
                    const durationMatch = route.duration.match(/(\d+)s/);
                    const durationSeconds = durationMatch ? parseInt(durationMatch[1]) : 0;
                    setTotalRouteDuration(durationSeconds);

                    // Process speed segments using speed limits when available
                    let speedSegments: SpeedSegment[] = [];
                    if (speedLimitSamples.length > 0) {
                        speedSegments = buildSpeedSegmentsFromSpeedLimits(distances, speedLimitSamples);
                    }

                    // Fallback to step durations if speed limits are unavailable
                    if (speedSegments.length === 0 && route.legs && route.legs.length > 0) {
                        let cumulativeDistance = 0;
                        const fallbackSegments: SpeedSegment[] = [];

                        for (const leg of route.legs) {
                            if (!leg.steps) continue;

                            for (const step of leg.steps) {
                                const stepDistance = step.distanceMeters || 0;
                                const stepDurationMatch = step.staticDuration?.match(/(\d+)s/);
                                const stepDuration = stepDurationMatch ? parseInt(stepDurationMatch[1]) : 1;

                                const startDistance = cumulativeDistance;
                                const endDistance = cumulativeDistance + stepDistance;
                                const speed = stepDuration > 0 ? stepDistance / stepDuration : DEFAULT_SPEED_MPS;

                                fallbackSegments.push({
                                    startDistance,
                                    endDistance,
                                    duration: stepDuration,
                                    speed
                                });

                                cumulativeDistance = endDistance;
                            }
                        }

                        speedSegments = fallbackSegments;
                    }

                    // Extract leg durations and distances
                    const legs: any[] = [];
                    if (route.legs && route.legs.length > 0) {
                        route.legs.forEach((leg: any) => {
                            const legDurationMatch = leg.duration?.match(/(\d+)s/);
                            const legDuration = legDurationMatch ? parseInt(legDurationMatch[1]) : 0;
                            
                            legs.push({
                                duration: legDuration,
                                distance: leg.distanceMeters || 0,
                                startLocation: {
                                    lat: leg.startLocation?.latLng?.latitude || 0,
                                    lng: leg.startLocation?.latLng?.longitude || 0
                                },
                                endLocation: {
                                    lat: leg.endLocation?.latLng?.latitude || 0,
                                    lng: leg.endLocation?.latLng?.longitude || 0
                                }
                            });
                        });
                        setLegDurations(legs.map((leg: any) => leg.duration));
                    } else {
                        setLegDurations([]);
                    }

                    // Prepare route data
                    const routeData: RouteData = {
                        origin,
                        destination,
                        duration: durationSeconds,
                        distance: route.distanceMeters || 0,
                        polyline: path,
                        speedSegments: speedSegments.length > 0 ? speedSegments : undefined,
                        legs: legs.length > 0 ? legs : undefined
                    };

                    console.log('Route legs:', legs.length, 'legs calculated');
                    console.log('Speed segments:', speedSegments.length, 'segments created');

                    // Store speed segments for animation
                    setSpeedSegments(speedSegments);

                    onRouteCalculated(routeData);
                }
            } catch (error) {
                console.error('Error calculating route:', error);
                setLegDurations([]);
                setTotalRouteDuration(0);
                map?.setTilt(0);
                map?.setHeading(0);
            }
        };

        computeRoute();
    }, [origin, destination, map, onRouteCalculated, apiKey, stopovers]);

    // Continuously animate progress marker with constant speed based on actual distance
    useEffect(() => {
        if (!progressMarkerRef.current || routePath.length === 0 || cumulativeDistances.length === 0) return;

        if (progress === 0) {
            progressMarkerRef.current.setVisible(false);
            startProgressRef.current = 0;
            targetProgressRef.current = 0;
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            return;
        }

        progressMarkerRef.current.setVisible(true);

        // Update target progress and start new animation cycle
        startProgressRef.current = targetProgressRef.current;
        targetProgressRef.current = progress;
        animationStartTimeRef.current = performance.now();

        // Calculate position on route based on time-weighted distance (variable speed)
        const getPositionAtProgress = (prog: number): google.maps.LatLng => {
            const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];
            let targetDistance: number;

            // Use speed segments if available for realistic speed variation
            if (speedSegments.length > 0) {
                // Calculate distance traveled based on elapsed time and segment speeds
                const totalDuration = speedSegments.reduce((sum, seg) => sum + seg.duration, 0);
                const elapsedTime = prog * totalDuration;

                let timeAccumulated = 0;
                targetDistance = 0;

                for (const segment of speedSegments) {
                    if (timeAccumulated + segment.duration >= elapsedTime) {
                        // We're in this segment
                        const timeInSegment = elapsedTime - timeAccumulated;
                        const distanceInSegment = timeInSegment * segment.speed;
                        targetDistance = segment.startDistance + distanceInSegment;
                        break;
                    }
                    timeAccumulated += segment.duration;
                    targetDistance = segment.endDistance;
                }
            } else {
                // Fallback to constant speed if no segments available
                targetDistance = prog * totalDistance;
            }

            // Find the polyline segment that contains this distance
            let segmentIndex = 0;
            for (let i = 0; i < cumulativeDistances.length - 1; i++) {
                if (targetDistance >= cumulativeDistances[i] && targetDistance <= cumulativeDistances[i + 1]) {
                    segmentIndex = i;
                    break;
                }
            }

            // Interpolate within the segment based on distance
            const segmentStartDist = cumulativeDistances[segmentIndex];
            const segmentEndDist = cumulativeDistances[segmentIndex + 1];
            const segmentLength = segmentEndDist - segmentStartDist;
            const distanceIntoSegment = targetDistance - segmentStartDist;
            const fraction = segmentLength > 0 ? distanceIntoSegment / segmentLength : 0;

            const startPoint = routePath[segmentIndex];
            const endPoint = routePath[segmentIndex + 1];

            const interpolatedLat = startPoint.lat() + (endPoint.lat() - startPoint.lat()) * fraction;
            const interpolatedLng = startPoint.lng() + (endPoint.lng() - startPoint.lng()) * fraction;

            return new google.maps.LatLng(interpolatedLat, interpolatedLng);
        };

        // Smooth animation function - runs continuously until next progress update
        const animate = (currentTime: number) => {
            if (!progressMarkerRef.current) return;

            const elapsed = currentTime - animationStartTimeRef.current;
            // Animate over 1 second to match the timer update interval
            const duration = 1000;
            const animationProgress = Math.min(elapsed / duration, 1);

            // Linear interpolation between start and target progress
            const currentProgress = startProgressRef.current +
                (targetProgressRef.current - startProgressRef.current) * animationProgress;

            const position = getPositionAtProgress(currentProgress);
            
            // Calculate heading for the next position to rotate the arrow
            const nextProgress = currentProgress + 0.001; // Small step ahead
            if (nextProgress <= 1) {
                const nextPosition = getPositionAtProgress(nextProgress);
                const heading = google.maps.geometry.spherical.computeHeading(position, nextPosition);
                currentHeadingRef.current = heading;
                if (autoCenterActiveRef.current && map) {
                    map.setHeading(heading);
                    if (map.getTilt() !== 60) {
                        map.setTilt(60);
                    }
                }
                
                // Update marker with new position and rotation
                progressMarkerRef.current.setIcon({
                    path: 'M 0,-2 L -1.5,2 L 0,1 L 1.5,2 Z',
                    fillColor: '#F59E0B',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                    scale: 3,
                    anchor: new google.maps.Point(0, 0),
                    rotation: heading
                });
            }
            
            progressMarkerRef.current.setPosition(position);

            // Update marker position for auto-centering
            setCurrentMarkerPosition(position);

            // Continue animation until we reach the target
            if (animationProgress < 1) {
                animationFrameRef.current = requestAnimationFrame(animate);
            }
        };

        // Cancel any existing animation and start new one
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [progress, routePath, cumulativeDistances, speedSegments, map]);

    return null;
}

async function fetchSpeedLimitsForRoute(points: SimpleLatLng[]): Promise<number[]> {
    if (!SPEED_LIMITS_ENABLED) {
        return [];
    }

    if (points.length === 0) {
        return [];
    }

    const samples: Array<number | null> = new Array(points.length).fill(null);
    const step = Math.max(MAX_SPEED_LIMIT_POINTS_PER_REQUEST - 1, 1);

    for (let start = 0; start < points.length; start += step) {
        const end = Math.min(points.length, start + MAX_SPEED_LIMIT_POINTS_PER_REQUEST);
        const chunk = points.slice(start, end);
        if (chunk.length < 2) {
            continue;
        }

        const params = new URLSearchParams();
        params.set('units', 'KPH');
        const pathValue = chunk.map(point => `${point.lat},${point.lng}`).join('|');
        params.set('path', pathValue);

        try {
            const response = await fetch(`/api/roads-speed-limits?${params.toString()}`);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Speed limits request failed:', response.status, errorText);
                continue;
            }

            const data = await response.json();
            const speedMap = new Map<string, number>();

            data?.speedLimits?.forEach((limit: any) => {
                const converted = convertSpeedLimitToMps(limit?.speedLimit, limit?.units);
                if (typeof converted === 'number' && limit?.placeId) {
                    speedMap.set(limit.placeId, converted);
                }
            });

            data?.snappedPoints?.forEach((snapped: any) => {
                const originalIndex = typeof snapped?.originalIndex === 'number' ? snapped.originalIndex : null;
                const placeId = snapped?.placeId;

                if (originalIndex === null || !placeId || !speedMap.has(placeId)) {
                    return;
                }

                const globalIndex = start + originalIndex;
                if (globalIndex >= 0 && globalIndex < samples.length) {
                    samples[globalIndex] = speedMap.get(placeId) ?? null;
                }
            });
        } catch (error) {
            console.error('Speed limits fetch error:', error);
        }
    }

    if (!samples.some(value => value !== null)) {
        return [];
    }

    return samples.map(value => {
        return typeof value === 'number' && value > 0 ? value : DEFAULT_SPEED_MPS;
    });
}

function buildSpeedSegmentsFromSpeedLimits(distances: number[], speedSamples: number[]): SpeedSegment[] {
    if (distances.length <= 1 || speedSamples.length === 0) {
        return [];
    }

    const segments: SpeedSegment[] = [];

    for (let i = 1; i < distances.length; i++) {
        const startDistance = distances[i - 1];
        const endDistance = distances[i];
        const segmentDistance = endDistance - startDistance;
        if (segmentDistance <= 0) {
            continue;
        }

        const prevSample = i - 1 < speedSamples.length ? speedSamples[i - 1] : undefined;
        const nextSample = i < speedSamples.length ? speedSamples[i] : undefined;

        const validPrev = typeof prevSample === 'number' && prevSample > 0;
        const validNext = typeof nextSample === 'number' && nextSample > 0;

        let segmentSpeed = DEFAULT_SPEED_MPS;
        if (validPrev && validNext) {
            segmentSpeed = (prevSample + nextSample) / 2;
        } else if (validPrev) {
            segmentSpeed = prevSample as number;
        } else if (validNext) {
            segmentSpeed = nextSample as number;
        }

        if (!Number.isFinite(segmentSpeed) || segmentSpeed <= 0) {
            segmentSpeed = DEFAULT_SPEED_MPS;
        }

        const duration = segmentSpeed > 0 ? segmentDistance / segmentSpeed : segmentDistance / DEFAULT_SPEED_MPS;
        segments.push({
            startDistance,
            endDistance,
            duration,
            speed: segmentSpeed
        });
    }

    return segments;
}

function convertSpeedLimitToMps(value?: number, units?: string): number | null {
    if (!Number.isFinite(value) || !value || value <= 0) {
        return null;
    }

    if (units === 'MPH') {
        return value * MPS_PER_MPH;
    }

    return value * MPS_PER_KPH;
}
