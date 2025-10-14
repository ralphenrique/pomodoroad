import type { RouteData } from '@/types';

interface RouteInfoProps {
  routeData: RouteData | null;
}

export default function RouteInfo({ routeData }: RouteInfoProps) {
  if (!routeData) {
    return (
    <>
    </>
    );
  }

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDistance = (meters: number): string => {
    const km = meters / 1000;
    if (km >= 1) {
      return `${km.toFixed(1)} km`;
    }
    return `${meters.toFixed(0)} m`;
  };

  return (
    <div className="bg-gray-900/90 backdrop-blur-md rounded-lg p-6 space-y-4 shadow-2xl border border-gray-700/50">
      <h3 className="text-lg font-semibold text-white">Journey Details</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-lg p-4 border border-gray-700/30">
          <div className="text-gray-300 text-sm mb-1">Focus Time</div>
          <div className="text-2xl font-bold text-blue-400">
            {formatDuration(routeData.duration)}
          </div>
        </div>
        
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-lg p-4 border border-gray-700/30">
          <div className="text-gray-300 text-sm mb-1">Distance</div>
          <div className="text-2xl font-bold text-purple-400">
            {formatDistance(routeData.distance)}
          </div>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <span className="text-green-400 mt-1">📍</span>
          <div>
            <div className="text-gray-300">From</div>
            <div className="text-white font-medium">{routeData.origin.address}</div>
          </div>
        </div>
        
        <div className="flex items-start gap-2">
          <span className="text-red-400 mt-1">🎯</span>
          <div>
            <div className="text-gray-300">To</div>
            <div className="text-white font-medium">{routeData.destination.address}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
