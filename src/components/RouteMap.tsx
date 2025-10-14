import { useEffect, useState } from 'react';
import { Map } from '@vis.gl/react-google-maps';
import type { Location, RouteData } from '../types';
import RouteRenderer from './RouteRenderer';

interface RouteMapProps {
    apiKey: string;
    origin: Location | null;
    destination: Location | null;
    onRouteCalculated: (routeData: RouteData) => void;
    progress: number; // 0 to 1 representing journey progress
    autoCenterOnMarker?: boolean;
    stopovers?: Location[];
    onStopoverPositionsCalculated?: (positions: number[]) => void;
    onMapInteraction?: () => void;
    showHelperCircles?: boolean;
    helperCirclePositions?: google.maps.LatLng[];
    mapId?: string;
}

export default function RouteMap({
    apiKey,
    origin,
    destination,
    onRouteCalculated,
    progress,
    autoCenterOnMarker,
    stopovers = [],
    onStopoverPositionsCalculated,
    onMapInteraction,
    showHelperCircles = false,
    helperCirclePositions = [],
    mapId
}: RouteMapProps) {
    const [initialCenter, setInitialCenter] = useState<{ lat: number; lng: number } | null>(null);

    // Get user's location on mount
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userPos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    console.log('User location:', userPos);
                    setInitialCenter(userPos);
                },
                (error) => {
                    console.log('Geolocation error:', error.message);
                    // Set default center (San Francisco)
                    setInitialCenter({ lat: 37.7749, lng: -122.4194 });
                }
            );
        } else {
            // Geolocation not supported, use default
            setInitialCenter({ lat: 37.7749, lng: -122.4194 });
        }
    }, []);

    // Don't render map until we have initial center
    if (!initialCenter) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-900">
                <div className="text-gray-400">Loading map...</div>
            </div>
        );
    }

    // Base dark theme styles
    const baseStyles = [
        {
            elementType: "geometry",
            stylers: [{ color: "#242f3e" }]
        },
        {
            elementType: "labels.text.fill",
            stylers: [{ color: "#9ca5b3" }]
        },
        {
            elementType: "labels.text.stroke",
            stylers: [{ color: "#242f3e" }]
        },
        {
            featureType: "administrative.locality",
            elementType: "labels.text.fill",
            stylers: [{ color: "#9ca5b3" }]
        },
        {
            featureType: "poi",
            elementType: "labels.text.fill",
            stylers: [{ color: "#8a8a8a" }]
        },
        {
            featureType: "poi.park",
            elementType: "geometry",
            stylers: [{ color: "#263c3f" }]
        },
        {
            featureType: "poi.park",
            elementType: "labels.text.fill",
            stylers: [{ color: "#8a8a8a" }]
        },
        {
            featureType: "road",
            elementType: "geometry",
            stylers: [{ color: "#38414e" }]
        },
        {
            featureType: "road",
            elementType: "geometry.stroke",
            stylers: [{ color: "#212a37" }]
        },
        {
            featureType: "road",
            elementType: "labels.text.fill",
            stylers: [{ color: "#9ca5b3" }]
        },
        {
            featureType: "road.highway",
            elementType: "geometry",
            stylers: [{ color: "#746855" }]
        },
        {
            featureType: "road.highway",
            elementType: "geometry.stroke",
            stylers: [{ color: "#1f2835" }]
        },
        {
            featureType: "road.highway",
            elementType: "labels.text.fill",
            stylers: [{ color: "#b0b0b0" }]
        },
        {
            featureType: "transit",
            elementType: "geometry",
            stylers: [{ color: "#2f3948" }]
        },
        {
            featureType: "transit.station",
            elementType: "labels.text.fill",
            stylers: [{ color: "#8a8a8a" }]
        },
        {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#17263c" }]
        },
        {
            featureType: "water",
            elementType: "labels.text.fill",
            stylers: [{ color: "#515c6d" }]
        },
        {
            featureType: "water",
            elementType: "labels.text.stroke",
            stylers: [{ color: "#17263c" }]
        }
    ];

    // Hide POI labels when journey is in progress
    const hidePOIStyles = [
        {
            featureType: "poi",
            stylers: [{ visibility: "off" }]
        },
        {
            featureType: "poi.business",
            stylers: [{ visibility: "off" }]
        },
        {
            featureType: "poi.place_of_worship",
            stylers: [{ visibility: "off" }]
        },
        {
            featureType: "poi.attraction",
            stylers: [{ visibility: "off" }]
        },
        {
            featureType: "poi.government",
            stylers: [{ visibility: "off" }]
        },
        {
            featureType: "poi.medical",
            stylers: [{ visibility: "off" }]
        },
        {
            featureType: "poi.school",
            stylers: [{ visibility: "off" }]
        }
    ];

    // Combine base styles with conditional POI hiding
    const mapStyles = progress > 0 ? [...baseStyles, ...hidePOIStyles] : baseStyles;

    return (
        <div className="w-full h-full overflow-hidden">
            <Map
                defaultCenter={initialCenter}
                defaultZoom={12}
                gestureHandling="greedy"
                disableDefaultUI={true}
                styles={mapStyles}
                mapId={mapId}
            >
                <RouteRenderer
                    origin={origin}
                    destination={destination}
                    onRouteCalculated={onRouteCalculated}
                    progress={progress}
                    apiKey={apiKey}
                    autoCenterOnMarker={autoCenterOnMarker}
                    stopovers={stopovers}
                    onStopoverPositionsCalculated={onStopoverPositionsCalculated}
                    onUserInteraction={onMapInteraction}
                    showHelperCircles={showHelperCircles}
                    helperCirclePositions={helperCirclePositions}
                />
            </Map>
        </div>
    );
}
