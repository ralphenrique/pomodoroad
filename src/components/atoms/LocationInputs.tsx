import LocationSearch from './LocationSearch';
import type { Location } from '../../types';
import { Input } from '../ui/input';
import { motion, AnimatePresence } from 'motion/react';

interface LocationInputsProps {
  originKey: string;
  destinationKey: string;
  onOriginSelect: (location: Location) => void;
  onDestinationSelect: (location: Location) => void;
  stopovers: Location[];
  onStopoversChange: (stopovers: Location[]) => void;
  stopoverDurations: number[];
  onStopoverDurationsChange: (durations: number[]) => void;
  disabled?: boolean;
}

export default function LocationInputs({
  originKey,
  destinationKey,
  onOriginSelect,
  onDestinationSelect,
  stopovers,
  onStopoversChange,
  stopoverDurations,
  onStopoverDurationsChange,
  disabled = false
}: LocationInputsProps) {
  const addStopover = () => {
    if (stopovers.length < 3) {
      onStopoversChange([...stopovers, { lat: 0, lng: 0 }]);
      onStopoverDurationsChange([...stopoverDurations, 5]); // Default 5 minutes
    }
  };

  const removeStopover = (index: number) => {
    onStopoversChange(stopovers.filter((_, i) => i !== index));
    onStopoverDurationsChange(stopoverDurations.filter((_, i) => i !== index));
  };

  const updateDuration = (index: number, duration: number) => {
    const newDurations = [...stopoverDurations];
    newDurations[index] = duration;
    onStopoverDurationsChange(newDurations);
  };

  const updateStopover = (index: number, location: Location) => {
    const newStopovers = [...stopovers];
    newStopovers[index] = location;
    onStopoversChange(newStopovers);
  };

  return (
    <>
      <LocationSearch
        key={originKey}
        label="Starting Point"
        placeholder="Enter starting location..."
        onLocationSelect={onOriginSelect}
        disabled={disabled}
      />
      
      <AnimatePresence mode="popLayout">
        {stopovers.map((_, index) => (
          <motion.div
            key={`stopover-${index}`}
            className="space-y-2"
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              opacity: { duration: 0.2 }
            }}
          >
            <LocationSearch
              key={`${originKey}-stopover-${index}`}
              label={`Stopover ${index + 1}`}
              placeholder="Enter stopover location..."
              onLocationSelect={(location) => updateStopover(index, location)}
              disabled={disabled}
              onRemove={() => removeStopover(index)}
              showRemove={true}
            />
            <div className="flex items-center gap-2 ml-1">
              <label className="text-sm text-gray-400">Rest Duration:</label>
              <Input
                type="number"
                min={1}
                max={60}
                value={stopoverDurations[index] || 5}
                onChange={(e) => updateDuration(index, parseInt(e.target.value) || 5)}
                disabled={disabled}
                className="w-16 h-8 bg-gray-800/50 border-gray-700 text-white"
              />
              <span className="text-sm text-gray-400">minutes</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      
      {!disabled && stopovers.length < 3 && (
        <motion.button
          onClick={addStopover}
          className="w-full py-2 px-4 bg-gray-800/50 hover:bg-gray-700/50 rounded-2xl text-gray-400 hover:text-white transition-colors text-sm"
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          + Add Stopover
        </motion.button>
      )}
      
      <LocationSearch
        key={destinationKey}
        label="Destination"
        placeholder="Enter destination..."
        onLocationSelect={onDestinationSelect}
        disabled={disabled}
      />
    </>
  );
}
