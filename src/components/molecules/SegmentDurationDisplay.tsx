import { motion } from 'motion/react';
import type { RouteLeg } from '../../types';
import { Clock, AlertCircle } from 'lucide-react';

interface SegmentDurationDisplayProps {
  legs: RouteLeg[];
  stopovers?: any[];
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

function getDurationColor(seconds: number): { bg: string; text: string; border: string } {
  const minutes = seconds / 60;
  
  // Ideal Pomodoro: 20-30 minutes
  if (minutes >= 20 && minutes <= 30) {
    return {
      bg: 'bg-green-500/10',
      text: 'text-green-400',
      border: 'border-green-500/30'
    };
  }
  
  // Close: 15-20 or 30-35 minutes
  if ((minutes >= 15 && minutes < 20) || (minutes > 30 && minutes <= 35)) {
    return {
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-400',
      border: 'border-yellow-500/30'
    };
  }
  
  // Too short or too long
  return {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30'
  };
}

function getSegmentLabel(index: number, totalLegs: number): string {
  if (totalLegs === 1) {
    // Single segment - direct route with no stopovers
    return index === 0 ? 'Start' : 'Destination';
  }
  
  // Multiple segments (with stopovers)
  // index 0 = Start
  // index 1 = Stop 1 (first stopover)
  // index 2 = Stop 2 (second stopover)
  // index n = Destination
  if (index === 0) return 'Start';
  if (index === totalLegs) return 'Destination';
  return `Stop ${index}`;
}

function getSuggestion(duration: number, index: number, totalLegs: number): string | null {
  const minutes = duration / 60;
  
  if (minutes < 15) {
    if (index === 0) return 'Consider starting from a location further away';
    if (index === totalLegs - 1) return 'Consider choosing a destination further away';
    return `Move Stop ${index} further from Stop ${index - 1}`;
  }
  
  if (minutes > 35) {
    if (index === totalLegs - 1) return 'Consider choosing a closer destination or add a stopover';
    return `Move Stop ${index} closer to Stop ${index - 1}, or add a stopover between them`;
  }
  
  if (minutes >= 15 && minutes < 20) {
    if (index === totalLegs - 1) return 'Good! Slightly shorter segment - consider moving destination a bit further';
    return `Good! Consider moving Stop ${index} slightly further for ideal 25min`;
  }
  
  if (minutes > 30 && minutes <= 35) {
    if (index === totalLegs - 1) return 'Good! Slightly longer segment - consider moving destination a bit closer';
    return `Good! Consider moving Stop ${index} slightly closer for ideal 25min`;
  }
  
  return null;
}

export default function SegmentDurationDisplay({ legs }: SegmentDurationDisplayProps) {
  if (!legs || legs.length === 0) return null;

  const totalPomodoros = legs.length;
  const idealCount = legs.filter(leg => {
    const minutes = leg.duration / 60;
    return minutes >= 20 && minutes <= 30;
  }).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* Summary Header */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">{legs.length === 1 ? 'Full Trip' : 'Travel Segments'}</span>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{totalPomodoros} Pomodoro{totalPomodoros !== 1 ? 's' : ''}</span>
          {idealCount > 0 && (
            <span className="text-green-400 text-xs">
              ({idealCount} ideal)
            </span>
          )}
        </div>
      </div>

      {/* Leg Durations */}
      <div className="space-y-2">
        {legs.map((leg, index) => {
          const colors = getDurationColor(leg.duration);
          const fromLabel = getSegmentLabel(index, legs.length);
          const toLabel = getSegmentLabel(index + 1, legs.length);
          const suggestion = getSuggestion(leg.duration, index + 1, legs.length);
          
          return (
            <motion.div
              key={`leg-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="space-y-1"
            >
              <div className={`flex items-center justify-between p-2 rounded-lg border ${colors.border} ${colors.bg}`}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Clock className={`w-4 h-4 flex-shrink-0 ${colors.text}`} />
                  <div className="flex items-center gap-1.5 text-sm min-w-0">
                    <span className="text-gray-300 truncate">{fromLabel}</span>
                    <span className="text-gray-600">→</span>
                    <span className="text-gray-300 truncate">{toLabel}</span>
                  </div>
                </div>
                <span className={`font-medium text-sm flex-shrink-0 ml-2 ${colors.text}`}>
                  {formatDuration(leg.duration)}
                </span>
              </div>
              {suggestion && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex items-start gap-1.5 px-2 py-1 text-xs text-gray-400"
                >
                  <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span className="leading-tight">{suggestion}</span>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Helper Text */}
      <div className="text-xs text-gray-500 pt-1">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Ideal (20-30m)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            Close (15-20m, 30-35m)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            Adjust needed
          </span>
        </div>
      </div>
    </motion.div>
  );
}
