# Routes API Implementation

## Overview
This project uses Google's **Routes API (v2)** instead of the legacy Directions API for calculating routes and travel times.

## Key Differences

### Routes API (New - What we're using)
- REST API endpoint: `https://routes.googleapis.com/directions/v2:computeRoutes`
- More accurate with real-time traffic data
- Better performance and more features
- Field masking for efficient data retrieval
- Modern JSON-based responses

### Directions API (Legacy - Not using)
- JavaScript library-based: `google.maps.DirectionsService`
- Older technology
- Less accurate traffic predictions
- Being phased out

## API Configuration

### Required APIs in Google Cloud Console
Make sure these are enabled in your Google Cloud project:
1. **Routes API** (primary)
2. **Maps JavaScript API** (for map rendering)
3. **Places API** (for location autocomplete)

### Environment Variables
```env
VITE_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

## Implementation Details

### Request Format
```json
{
  "origin": {
    "location": {
      "latLng": {
        "latitude": 37.7749,
        "longitude": -122.4194
      }
    }
  },
  "destination": {
    "location": {
      "latLng": {
        "latitude": 34.0522,
        "longitude": -118.2437
      }
    }
  },
  "travelMode": "DRIVE",
  "routingPreference": "TRAFFIC_AWARE"
}
```

### Headers
- `Content-Type: application/json`
- `X-Goog-Api-Key`: Your API key
- `X-Goog-FieldMask`: Specifies which fields to return (reduces data transfer)

### Field Mask Used
```
routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs
```

## Response Data

The API returns:
- **duration**: Travel time in format "1234s" (seconds)
- **distanceMeters**: Distance in meters
- **polyline.encodedPolyline**: Encoded polyline string representing the route path
- **legs**: Detailed information about route segments

## Polyline Decoding

The Routes API returns an encoded polyline string. We decode it client-side to get the actual path coordinates for rendering on the map.

## Benefits for FocusRoute

1. **More Accurate Timers**: Real-time traffic data means more realistic focus session durations
2. **Better Routes**: Optimized routing considering current conditions
3. **Future-Proof**: Using the modern API that Google is actively developing
4. **Efficient**: Field masking reduces unnecessary data transfer

## Pricing

Routes API has different pricing than Directions API. Check current pricing at:
https://mapsplatform.google.com/pricing/

**Note**: For development, Google provides $200/month free credit which should be sufficient for testing.
