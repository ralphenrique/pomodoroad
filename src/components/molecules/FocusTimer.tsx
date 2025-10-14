import { useEffect, useState } from 'react';
import { Coffee } from 'lucide-react';
import type { Location } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../animate-ui/components/radix/alert-dialog';

interface FocusTimerProps {
  totalTime: number; // in seconds
  isRunning: boolean;
  onTimeUpdate: (elapsedTime: number, progress: number) => void;
  onComplete: () => void;
  elapsedTime?: number; // in seconds
  stopovers?: Location[];
  stopoverDurations?: number[]; // rest durations in minutes
  stopoverPositions?: number[]; // actual positions along route (0-1)
  isResting?: boolean;
  restTimeRemaining?: number; // in seconds
  onRestStart?: (index: number, duration: number) => void;
  onRestComplete?: () => void;
  onRestTick?: (remaining: number) => void;
}

export default function FocusTimer({
  totalTime,
  isRunning,
  onTimeUpdate,
  onComplete,
  elapsedTime: externalElapsedTime = 0,
  stopovers = [],
  stopoverDurations = [],
  stopoverPositions = [],
  isResting = false,
  restTimeRemaining = 0,
  onRestStart,
  onRestComplete,
  onRestTick
}: FocusTimerProps) {
  const [elapsedTime, setElapsedTime] = useState(externalElapsedTime);
  const [completedStopovers, setCompletedStopovers] = useState<number[]>([]);
  const [showRestCompleteDialog, setShowRestCompleteDialog] = useState(false);

  // Sync with external elapsed time when provided
  useEffect(() => {
    setElapsedTime(externalElapsedTime);
  }, [externalElapsedTime]);

  // Reset completed stopovers when inputs change
  useEffect(() => {
    setCompletedStopovers([]);
  }, [totalTime, stopovers, stopoverPositions]);

  // Check if we've reached a stopover
  useEffect(() => {
    if (!isRunning || stopovers.length === 0 || stopoverPositions.length === 0 || !onRestStart) return;

    const progress = elapsedTime / totalTime;

    stopovers.forEach((_, index) => {
      const stopoverPercentage = stopoverPositions[index];

      if (!stopoverPercentage) return;

      // Check if we've just reached this stopover (within 0.5% tolerance)
      if (!completedStopovers.includes(index) &&
        progress >= stopoverPercentage &&
        progress < stopoverPercentage + 0.005) {
        const duration = stopoverDurations[index] || 5;
        setCompletedStopovers(prev => [...prev, index]);
        onRestStart(index, duration);
      }
    });
  }, [elapsedTime, totalTime, stopovers, stopoverDurations, stopoverPositions, completedStopovers, isRunning, onRestStart]);

  // Rest timer countdown
  useEffect(() => {
    if (!isResting || restTimeRemaining <= 0) return;

    const interval = setInterval(() => {
      if (onRestTick) {
        const newRemaining = restTimeRemaining - 1;
        onRestTick(newRemaining);

        if (newRemaining <= 0) {
          setShowRestCompleteDialog(true);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isResting, restTimeRemaining, onRestTick]);

  useEffect(() => {
    if (!isRunning || totalTime === 0) return;

    const interval = setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1;

        if (newTime >= totalTime) {
          clearInterval(interval);
          onComplete();
          return totalTime;
        }

        const progress = newTime / totalTime;
        onTimeUpdate(newTime, progress);
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, totalTime, onTimeUpdate, onComplete]);

  // Reset when totalTime changes
  useEffect(() => {
    setElapsedTime(0);
  }, [totalTime]);


  const progress = totalTime > 0 ? (elapsedTime / totalTime) * 100 : 0;

  // Calculate time to next stopover
  const getNextStopoverTime = (): number | null => {
    if (stopovers.length === 0 || stopoverPositions.length === 0) return null;

    const currentProgress = elapsedTime / totalTime;

    for (let i = 0; i < stopovers.length; i++) {
      if (completedStopovers.includes(i)) continue;

      const stopoverPercentage = stopoverPositions[i];
      if (!stopoverPercentage) continue;

      if (stopoverPercentage > currentProgress) {
        const timeToStopover = (stopoverPercentage - currentProgress) * totalTime;
        return Math.max(0, timeToStopover);
      }
    }

    return null;
  };

  const nextStopoverTime = getNextStopoverTime();

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleContinueJourney = () => {
    setShowRestCompleteDialog(false);
    if (onRestComplete) {
      onRestComplete();
    }
  };

  return (
    <>
      <div className="w-full space-y-4">
        <div className='flex justify-between items-center'>
          <h3 className="text-lg font-semibold">Progress</h3>

          {/* Time to Next Stopover */}
          {nextStopoverTime !== null && !isResting && (
            <div className="flex items-center gap-2 justify-center text-sm">
              <span className="text-gray-400">Next rest stop in:</span>
              <span className="text-yellow-400 font-semibold">{formatTime(nextStopoverTime)}</span>
            </div>
          )}
        </div>


        {/* Rest Timer */}
        {isResting && restTimeRemaining == 0 && (
          <div className="flex items-center justify-center gap-3 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-2xl">
            <Coffee className="h-5 w-5 text-yellow-400" />
            <div className="text-center">
              <div className="text-sm text-gray-400">Resting at stopover</div>
              <div className="text-2xl font-bold text-yellow-400">{formatTime(restTimeRemaining)}</div>
            </div>
          </div>
        )}

        {/* Progress Bar with Labels */}
        <div className="relative">
          <div className="flex items-center gap-2">
            {/* Start Label */}
            <div className="flex-shrink-0 w-6 h-6 bg-green-400 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white">
              A
            </div>

            {/* Progress Bar */}
            <div className="flex-1 relative bg-gray-800 rounded-full h-3 overflow-visible">
              <div
                className="bg-white h-full transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${progress}%` }}
              />

              {/* Stopover Markers */}
              {stopovers.map((_, index) => {
                const stopoverPercentage = stopoverPositions[index];
                if (!stopoverPercentage) return null;

                return (
                  <div
                    key={`stopover-marker-${index}`}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                    style={{ left: `${stopoverPercentage * 100}%` }}
                  >
                    <div className="w-4 h-4 bg-yellow-400 rounded-full border-2 border-white shadow-lg" />
                  </div>
                );
              })}
            </div>

            {/* End Label */}
            <div className="flex-shrink-0 w-6 h-6 bg-red-400 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white">
              B
            </div>
          </div>
        </div>

        {/* Time Display */}
        {/* <div className="text-center space-y-2">
        <div className="text-5xl font-bold text-white font-mono">
          {formatTime(elapsedTime)}
        </div>
        <div className="text-sm text-gray-400">
          of {formatTime(totalTime)}
        </div>
        <div className="text-xs text-gray-500">
          {progress.toFixed(1)}% complete
        </div>
      </div> */}
      </div>

      {/* Rest Complete Dialog */}
      <AlertDialog open={showRestCompleteDialog} onOpenChange={setShowRestCompleteDialog}>
        <AlertDialogContent className="bg-gray-900/95 backdrop-blur-xl border-yellow-500/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <Coffee className="h-5 w-5 text-yellow-400" />
              Rest Complete!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Your rest stop is over. Ready to continue your journey?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={handleContinueJourney}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
            >
              Continue Journey
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
