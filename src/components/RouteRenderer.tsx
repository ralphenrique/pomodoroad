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
}

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
    onUserInteraction
}: RouteRendererProps) {
    const map = useMap();
    const polylineRef = useRef<google.maps.Polyline | null>(null);
    const originMarkerRef = useRef<google.maps.Marker | null>(null);
    const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
    const progressMarkerRef = useRef<google.maps.Marker | null>(null);
    const stopoverMarkersRef = useRef<google.maps.Marker[]>([]);
    const [routePath, setRoutePath] = useState<google.maps.LatLng[]>([]);
    const [cumulativeDistances, setCumulativeDistances] = useState<number[]>([]);
    const [speedSegments, setSpeedSegments] = useState<any[]>([]);
    const animationFrameRef = useRef<number | null>(null);
    const startProgressRef = useRef<number>(0);
    const targetProgressRef = useRef<number>(0);
    const animationStartTimeRef = useRef<number>(0);
    const [currentMarkerPosition, setCurrentMarkerPosition] = useState<google.maps.LatLng | null>(null);
    const prevAutoCenterRef = useRef<boolean>(false);
    const autoCenterStartTimeRef = useRef<number>(0);
    const autoCenterActiveRef = useRef<boolean>(!!autoCenterOnMarker);

    useEffect(() => {
        autoCenterActiveRef.current = !!autoCenterOnMarker;
    }, [autoCenterOnMarker]);

    // Auto-center on marker when enabled - keep marker centered during movement
    useEffect(() => {
        if (!map || !currentMarkerPosition) return;

        // Detect when auto-center is toggled on
        if (autoCenterOnMarker && !prevAutoCenterRef.current) {
            // Just enabled - set zoom and start delay timer
            map.setZoom(17);
            autoCenterStartTimeRef.current = Date.now();
            prevAutoCenterRef.current = true;

            // Set center after 1 second delay
            setTimeout(() => {
                if (autoCenterOnMarker && currentMarkerPosition) {
                    map.setCenter(currentMarkerPosition);
                }
            }, 500);
            return;
        }

        // Track when auto-center is toggled off
        if (!autoCenterOnMarker && prevAutoCenterRef.current) {
            prevAutoCenterRef.current = false;
            return;
        }

        // Continue centering if auto-center is active and delay has passed
        if (autoCenterOnMarker && Date.now() - autoCenterStartTimeRef.current >= 1000) {
            map.setCenter(currentMarkerPosition);
        }
    }, [currentMarkerPosition, map, autoCenterOnMarker]);

    // Disable auto-center when the user manually interacts with the map
    useEffect(() => {
        if (!map || !onUserInteraction) return;

        const handleInteraction = () => {
            if (!autoCenterActiveRef.current) return;
            autoCenterActiveRef.current = false;
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
        const positions: number[] = [];

        // Create new stopover markers and calculate their positions
        stopovers.forEach((stopover, index) => {
            if (stopover.lat === 0 && stopover.lng === 0) {
                positions.push(0);
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
            positions.push(positionPercentage);

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

        // Notify parent of calculated positions
        if (onStopoverPositionsCalculated) {
            onStopoverPositionsCalculated(positions);
        }
    }, [map, stopovers, routePath, cumulativeDistances, onStopoverPositionsCalculated]);

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

            // Cancel any ongoing animation
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [map]);

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
                    routingPreference: 'TRAFFIC_AWARE',
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
                        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.polyline'
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

                    // Process steps to create speed segments
                    const speedSegments: any[] = [];
                    if (route.legs && route.legs.length > 0) {
                        let cumulativeDistance = 0;

                        for (const leg of route.legs) {
                            if (!leg.steps) continue;

                            for (const step of leg.steps) {
                                const stepDistance = step.distanceMeters || 0;
                                const stepDurationMatch = step.staticDuration?.match(/(\d+)s/);
                                const stepDuration = stepDurationMatch ? parseInt(stepDurationMatch[1]) : 1;

                                const startDistance = cumulativeDistance;
                                const endDistance = cumulativeDistance + stepDistance;
                                const speed = stepDuration > 0 ? stepDistance / stepDuration : 0;

                                speedSegments.push({
                                    startDistance,
                                    endDistance,
                                    duration: stepDuration,
                                    speed
                                });

                                cumulativeDistance = endDistance;
                            }
                        }
                    }

                    // Prepare route data
                    const routeData: RouteData = {
                        origin,
                        destination,
                        duration: durationSeconds,
                        distance: route.distanceMeters || 0,
                        polyline: path,
                        speedSegments: speedSegments.length > 0 ? speedSegments : undefined
                    };

                    console.log('Speed segments:', speedSegments.length, 'segments created');

                    // Store speed segments for animation
                    setSpeedSegments(speedSegments);

                    onRouteCalculated(routeData);
                }
            } catch (error) {
                console.error('Error calculating route:', error);
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
    }, [progress, routePath, cumulativeDistances, speedSegments]);

    return null;
}
