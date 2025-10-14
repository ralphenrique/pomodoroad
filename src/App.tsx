import { useState, useCallback } from 'react';
import { APIProvider, useApiLoadingStatus, APILoadingStatus } from '@vis.gl/react-google-maps';
import { motion, AnimatePresence } from 'motion/react';
import './App.css';
import RouteMap from './components/RouteMap';
import FocusTimer from './components/molecules/FocusTimer';
import TimeLeft from './components/atoms/TimeLeft';
import DistanceLeft from './components/atoms/DistanceLeft';
import Toggle from './components/atoms/Toggle';
import PauseButton from './components/atoms/PauseButton';
import InfoToggle from './components/atoms/InfoToggle';
import { Info } from 'lucide-react';
import JourneyPlanner from './components/organisms/JourneyPlanner';
import type { Location, RouteData } from './types';
import Button from './components/atoms/Button';
import { Navigation, NavigationOff } from 'lucide-react';
import CompletionDialog from './components/molecules/CompletionDialog';

interface FocusRouteAppProps {
  apiKey: string;
}

function FocusRouteApp({ apiKey }: FocusRouteAppProps) {
  const status = useApiLoadingStatus();
  const [origin, setOrigin] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [stopovers, setStopovers] = useState<Location[]>([]);
  const [stopoverDurations, setStopoverDurations] = useState<number[]>([]);
  const [stopoverPositions, setStopoverPositions] = useState<number[]>([]);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [isResting, setIsResting] = useState(false);
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [isJourneyStarted, setIsJourneyStarted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [autoCenterOnMarker, setAutoCenterOnMarker] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [showPlanner, setShowPlanner] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);

  const handleRouteCalculated = useCallback((data: RouteData) => {
    setRouteData(data);
  }, []);

  const handleStartJourney = () => {
    if (routeData) {
      setIsJourneyStarted(true);
      setProgress(0);
    }
  };

  const handlePauseJourney = () => {
    setIsJourneyStarted(false);
  };

  const handleResumeJourney = () => {
    if (routeData && progress > 0 && !isResting) {
      setIsJourneyStarted(true);
    }
  };

  const handleResetJourney = () => {
    setIsJourneyStarted(false);
    setProgress(0);
    setElapsedTime(0);
    setOrigin(null);
    setDestination(null);
    setStopovers([]);
    setStopoverDurations([]);
    setStopoverPositions([]);
    setRouteData(null);
    setAutoCenterOnMarker(false);
    setIsResting(false);
    setRestTimeRemaining(0);
    setResetKey(prev => prev + 1);
  };

  const handleTimeUpdate = useCallback((elapsed: number, progressValue: number) => {
    setProgress(progressValue);
    setElapsedTime(elapsed);
  }, []);

  const handleComplete = useCallback(() => {
    setIsJourneyStarted(false);
    setCompletionDialogOpen(true);
  }, []);

  const handleCompletionConfirm = useCallback(() => {
    handleResetJourney();
  }, []);

  const handleToggleAutoCenter = useCallback(() => {
    setAutoCenterOnMarker(prev => !prev);
  }, []);

  const handleMapInteraction = useCallback(() => {
    if (autoCenterOnMarker) {
      handleToggleAutoCenter();
    }
  }, [autoCenterOnMarker, handleToggleAutoCenter]);

  const canStartJourney = origin && destination && routeData && !isJourneyStarted;

  if (status === APILoadingStatus.NOT_LOADED || status === APILoadingStatus.LOADING) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading Google Maps...</p>
        </div>
      </div>
    );
  }

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2">Failed to Load Maps</h2>
          <p className="text-gray-400 mb-4">There was a problem loading Google Maps.</p>
          <p className="text-sm text-gray-500">
            Please verify your Google Maps API key and billing setup.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-white overflow-hidden">
      {/* Full-screen Map Background */}
      <div className="fixed inset-0 z-0">
        <RouteMap
          apiKey={apiKey}
          origin={origin}
          destination={destination}
          onRouteCalculated={handleRouteCalculated}
          progress={progress}
          autoCenterOnMarker={autoCenterOnMarker}
          stopovers={stopovers}
          onStopoverPositionsCalculated={setStopoverPositions}
          onMapInteraction={handleMapInteraction}
        />
      </div>

      {/* Overlay Content */}
      <div className="relative z-10 pointer-events-none">
        {/* <header className="bg-gray-900/80 backdrop-blur-md border-b border-gray-700/50 pointer-events-auto">
          <div className="container mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              🚗 FocusRoute
            </h1>
            <p className="text-gray-200 text-sm mt-1">
              Turn your focus time into a virtual road trip
            </p>
          </div>
        </header> */}

        <main className="px-4 py-8 h-screen">
          <div className="max-w-md pointer-events-auto">
            {/* Get Started Button - Only show when planner is closed */}
            <AnimatePresence>
              {!showPlanner && !isJourneyStarted && progress === 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className='absolute bottom-8 z-20'
                >
                  <Button
                    onClick={() => setShowPlanner(true)}
                    className=" bg-gray-900/60 backdrop-blur-md rounded-full p-4 px-12 border border-gray-600/50 "
                  >
                    <h1 className='text-center text-2xl font-bold'>Get Started</h1>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Journey Planner - Only show if not started and no progress */}
            <AnimatePresence>
              {showPlanner && !isJourneyStarted && progress === 0 && (
                <motion.div
                  className="bg-gray-900/70 backdrop-blur-md rounded-4xl p-6 shadow-2xl border border-gray-700/50"
                  initial={{
                    opacity: 0,
                    filter: 'blur(4px)',
                    transform: 'perspective(500px) rotateX(-20deg) scale(0.8)',
                  }}
                  animate={{
                    opacity: 1,
                    filter: 'blur(0px)',
                    transform: 'perspective(500px) rotateX(0deg) scale(1)',
                  }}
                  exit={{
                    opacity: 0,
                    filter: 'blur(4px)',
                    transform: 'perspective(500px) rotateX(-20deg) scale(0.8)',
                  }}
                  transition={{ type: 'spring', stiffness: 150, damping: 25 }}
                >
                  <JourneyPlanner
                    resetKey={resetKey}
                    isJourneyStarted={isJourneyStarted}
                    canStartJourney={!!canStartJourney}
                    onOriginSelect={setOrigin}
                    onDestinationSelect={setDestination}
                    stopovers={stopovers}
                    onStopoversChange={setStopovers}
                    stopoverDurations={stopoverDurations}
                    onStopoverDurationsChange={setStopoverDurations}
                    onStartJourney={handleStartJourney}
                    onResetJourney={handleResetJourney}
                  />
                </motion.div>
              )}
            </AnimatePresence>


            {/* Route Info */}
            {/* <div className="mt-6">
              <RouteInfo 
                routeData={routeData}
              />
            </div> */}

            {/* Pause Button - Top Left */}
            <AnimatePresence>
              {progress > 0 && routeData && (
                <motion.div
                  className="absolute top-8 left-6 z-20"
                  style={{ pointerEvents: 'auto' }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, ease: 'easeIn' }}
                >
                  <PauseButton
                    isPaused={!isJourneyStarted}
                    onPause={handlePauseJourney}
                    onResume={handleResumeJourney}
                    onQuit={handleResetJourney}
                    isResting={isResting}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Info Toggle - Always visible */}
            <motion.div
              className="absolute top-8 right-6 z-20"
              style={{ pointerEvents: 'auto' }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <Toggle
                autoCenterEnabled={infoDialogOpen}
                onToggle={() => setInfoDialogOpen(!infoDialogOpen)}
                activeIcon={<Info />}
                inactiveIcon={<Info />}
                enableRotation={false}
              />
            </motion.div>

            {/* Info Dialog */}
            <InfoToggle open={infoDialogOpen} onOpenChange={setInfoDialogOpen} />

            {/* Auto-Center Toggle */}
            <AnimatePresence>
              {progress > 0 && routeData && (
                <motion.div
                  className="absolute top-8 right-20 z-20 flex gap-4 items-end mr-2"
                  style={{ pointerEvents: 'auto' }}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  <Toggle
                    autoCenterEnabled={autoCenterOnMarker}
                    onToggle={handleToggleAutoCenter}
                    activeIcon={<Navigation />}
                    inactiveIcon={<NavigationOff />}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Components Container */}
            <AnimatePresence>
              {routeData && (isJourneyStarted || progress > 0) && (
                <motion.div
                  className="absolute bottom-8 left-6 right-6 z-20 flex gap-4 items-end"
                  style={{ pointerEvents: 'auto' }}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 40 }}
                  transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
                >
                  {/* Time Left */}
                  <motion.div
                    className="flex-shrink-0"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                  >
                    <TimeLeft timeLeft={routeData.duration - elapsedTime} />
                  </motion.div>

                  {/* Timer - Fills remaining space */}
                  <motion.div
                    className="flex-1 bg-gray-900/60 backdrop-blur-md rounded-4xl  p-6 border border-gray-700/50"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                  >
                    <h3 className="text-lg font-semibold mb-4">Focus Timer</h3>
                    <FocusTimer
                      totalTime={routeData.duration}
                      elapsedTime={elapsedTime}
                      isRunning={isJourneyStarted}
                      onTimeUpdate={handleTimeUpdate}
                      onComplete={handleComplete}
                      stopovers={stopovers}
                      stopoverDurations={stopoverDurations}
                      stopoverPositions={stopoverPositions}
                      isResting={isResting}
                      restTimeRemaining={restTimeRemaining}
                      onRestStart={(_index: number, duration: number) => {
                        setIsResting(true);
                        setRestTimeRemaining(duration * 60);
                        setIsJourneyStarted(false);
                      }}
                      onRestComplete={() => {
                        setIsResting(false);
                        setRestTimeRemaining(0);
                        setIsJourneyStarted(true);
                      }}
                      onRestTick={(remaining: number) => setRestTimeRemaining(remaining)}
                    />
                  </motion.div>

                  {/* Distance Left */}
                  <motion.div
                    className="flex-shrink-0"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.4 }}
                  >
                    <DistanceLeft distanceLeft={routeData.distance * (1 - progress)} />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
{/* completionDialogOpen */}
      {/* Completion Dialog */}
      <CompletionDialog
        open={completionDialogOpen}
        onOpenChange={setCompletionDialogOpen}
        onComplete={handleCompletionConfirm}
      />
    </div>
  );
}

function App() {
  const apiKey = import.meta.env.VITE_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2">API Key Missing</h2>
          <p className="text-gray-400 mb-4">Please set VITE_PUBLIC_GOOGLE_MAPS_API_KEY in your .env file.</p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={apiKey}
      libraries={["places", "marker", "geometry"]}
    >
      <FocusRouteApp apiKey={apiKey} />
    </APIProvider>
  );
}

export default App;
