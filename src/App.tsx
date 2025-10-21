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
import { Navigation, NavigationOff, ArrowLeft } from 'lucide-react';
import CompletionDialog from './components/molecules/CompletionDialog';
import { calculateHelperCirclePositions } from './utils/pomodoroHelper';
import Lottie from 'lottie-react';
import paperplaneAnimation from './assets/Loading.json';

interface FocusRouteAppProps {
  apiKey: string;
}

function FocusRouteApp({ apiKey }: FocusRouteAppProps) {
  const status = useApiLoadingStatus();
  const mapId = import.meta.env.VITE_PUBLIC_GOOGLE_MAP_ID;
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
  const [showHelperCircles, setShowHelperCircles] = useState(false);
  const [helperCirclePositions, setHelperCirclePositions] = useState<google.maps.LatLng[]>([]);

  const handleRouteCalculated = useCallback((data: RouteData) => {
    setRouteData(data);

    // Calculate helper circle positions when route is calculated
    if (data.polyline && data.duration && origin && destination) {
      const positions = calculateHelperCirclePositions(origin, destination, data.polyline, data.duration);
      setHelperCirclePositions(positions);
    }
  }, [origin, destination]);

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
    setShowHelperCircles(false);
    setHelperCirclePositions([]);
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
          <Lottie
            animationData={paperplaneAnimation}
            loop={true}
            style={{ width: 500, height: 500 }}
          />
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
          showHelperCircles={showHelperCircles}
          helperCirclePositions={helperCirclePositions}
          mapId={mapId}
        />
      </div>

      {/* Overlay Content */}
      <div className="relative z-10 pointer-events-none">
        <main className="px-4  h-screen">
          <div className="max-w-md pointer-events-none">
            {/* Get Started Button - Only show when planner is closed */}
            
            <AnimatePresence>
              {!showPlanner && !isJourneyStarted && progress === 0 && APILoadingStatus.LOADING && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className='absolute bottom-15 left-4 right-4 sm:left-auto sm:right-auto z-20 pointer-events-auto'
                >
                  <Button
                    onClick={() => setShowPlanner(true)}
                    className=" bg-gray-900/60 backdrop-blur-md w-full rounded-full p-4 px-12 border border-gray-600/50 "
                  >
                    <h1 className='text-center text-2xl font-bold'>Get Started</h1>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Journey Planner - Only show if not started and no progress */}
            <div className="h-screen overflow-y-scroll py-8 scrollbar-hide pointer-events-none ">
              <AnimatePresence>
                {showPlanner && !isJourneyStarted && progress === 0 && (
                  <motion.div
                    className="bg-gray-900/70 backdrop-blur-md rounded-4xl p-6 border border-gray-700/50 mt-20 md:mt-0 pointer-events-auto relative z-20"
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
                    {/* Back Button */}
                    <button
                      onClick={() => setShowPlanner(false)}
                      className="absolute top-6 right-6 p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/50 transition-colors duration-200"
                      aria-label="Close planner"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
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
                      routeData={routeData}
                      origin={origin}
                      destination={destination}
                      apiKey={apiKey}
                      onShowHelperCircles={setShowHelperCircles}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>



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
              className="absolute top-8 right-6 z-10"
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
            {/* routeData && (isJourneyStarted || progress > 0) */}
            {/* Bottom Components Container */}
            <AnimatePresence>
              {routeData && (isJourneyStarted || progress > 0) && (
                <motion.div
                  className="absolute bottom-8 left-6 right-6 z-20 flex flex-col md:flex-row gap-4 md:items-end"
                  style={{ pointerEvents: 'auto' }}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 40 }}
                  transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
                >
                  {/* Time Left & Distance Left - Top row on mobile, side items on desktop */}
                  <div className="flex justify-between gap-4 order-1 md:order-none">
                    <motion.div
                      className="flex-initial md:flex-shrink-0"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                    >
                      <TimeLeft timeLeft={routeData.duration - elapsedTime} />
                    </motion.div>

                    <motion.div
                      className="flex-initial md:flex-shrink-0 md:hidden"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.4 }}
                    >
                      <DistanceLeft distanceLeft={routeData.distance * (1 - progress)} />
                    </motion.div>
                  </div>

                  {/* Timer - Bottom on mobile, center on desktop */}
                  <motion.div
                    className="order-2 md:order-none md:flex-1 bg-gray-900/60 backdrop-blur-md rounded-xl lg:rounded-4xl p-3 lg:p-6 border border-gray-700/50"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                  >
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

                  {/* Distance Left - Desktop only, on the right */}
                  <motion.div
                    className="hidden md:block md:flex-shrink-0"
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
  const apiKey = import.meta.env.VITE_PUBLIC_GOOGLE_API_KEY;

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2">API Key Missing</h2>
          <p className="text-gray-400 mb-4">Please set VITE_PUBLIC_GOOGLE_API_KEY in your .env file.</p>
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
