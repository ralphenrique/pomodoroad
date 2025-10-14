interface TimeLeftProps {
  timeLeft: number; // in seconds
}

export default function TimeLeft({ timeLeft }: TimeLeftProps) {
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gray-900/60 backdrop-blur-md rounded-xl lg:rounded-4xl p-3 lg:p-6  border border-gray-700/50">
      <div className="text-xs text-gray-400 mb-1">Time Left</div>
      <div className="text-2xl font-bold text-blue-400 font-mono lg:text-5xl">{formatTime(timeLeft)}</div>
    </div>
  );
}
