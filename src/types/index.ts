export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface Stopover {
  location: Location;
  timePercentage: number; // 0-100, when this stopover occurs in the journey
  restDuration: number; // rest duration in minutes
}

export interface SpeedSegment {
  startDistance: number; // cumulative distance at segment start (meters)
  endDistance: number; // cumulative distance at segment end (meters)
  duration: number; // time to travel this segment (seconds)
  speed: number; // average speed for this segment (meters/second)
}

export interface RouteLeg {
  duration: number; // duration of this leg in seconds
  distance: number; // distance of this leg in meters
  startLocation: Location;
  endLocation: Location;
}

export interface RouteData {
  origin: Location;
  destination: Location;
  duration: number; // in seconds
  distance: number; // in meters
  polyline: google.maps.LatLng[];
  speedSegments?: SpeedSegment[]; // optional speed variation data
  stopovers?: Stopover[]; // optional stopovers along the route
  legs?: RouteLeg[]; // duration/distance for each leg between stops
}

export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  elapsedTime: number; // in seconds
  totalTime: number; // in seconds
}
