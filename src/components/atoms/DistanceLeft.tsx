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
    <div className="bg-gray-900/60 backdrop-blur-md rounded-4xl p-6 border border-gray-700/50">
      <div className="text-xs text-right text-gray-400 mb-1">Distance Left</div>
      <div className="text-5xl font-bold text-purple-400 font-mono">{formatDistance(distanceLeft)}</div>
    </div>
  );
}
