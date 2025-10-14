interface DistanceLeftProps {
  distanceLeft: number; // in meters
}

export default function DistanceLeft({ distanceLeft }: DistanceLeftProps) {
  const formatDistance = (meters: number): string => {
    const km = meters / 1000;
    if (km >= 1) {
      return `${km.toFixed(1)} km`;
    }
    return `${meters.toFixed(0)} m`;
  };

  return (
    <div className="bg-gray-900/60 backdrop-blur-md rounded-xl lg:rounded-4xl p-3 lg:p-6  border border-gray-700/50">
      <div className="text-xs text-gray-400 mb-1 text-right">Distance Left</div>
      <div className="text-2xl font-bold text-blue-400 font-mono lg:text-5xl">{formatDistance(distanceLeft)}</div>
    </div>
  );
}
