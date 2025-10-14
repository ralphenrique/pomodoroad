import { cn } from '@/lib/utils';
import LocationInputs from '../atoms/LocationInputs';
import JourneyControls from '../molecules/JourneyControls';
import type { Location } from '../../types';

interface JourneyPlannerProps {
	resetKey: number;
	isJourneyStarted: boolean;
	canStartJourney: boolean;
	onOriginSelect: (location: Location) => void;
	onDestinationSelect: (location: Location) => void;
	stopovers: Location[];
	onStopoversChange: (stopovers: Location[]) => void;
	stopoverDurations: number[];
	onStopoverDurationsChange: (durations: number[]) => void;
	onStartJourney: () => void;
	onResetJourney: () => void;
	className?: string;
}

export default function JourneyPlanner({
	resetKey,
	isJourneyStarted,
	canStartJourney,
	onOriginSelect,
	onDestinationSelect,
	stopovers,
	onStopoversChange,
	stopoverDurations,
	onStopoverDurationsChange,
	onStartJourney,
	onResetJourney,
	className,
}: JourneyPlannerProps) {
	return (
		<div className={cn('space-y-4', className)}>
			<h2 className="text-xl font-semibold mb-4">Plan Your Journey</h2>

			<LocationInputs
				originKey={`origin-${resetKey}`}
				destinationKey={`destination-${resetKey}`}
				onOriginSelect={onOriginSelect}
				onDestinationSelect={onDestinationSelect}
				stopovers={stopovers}
				onStopoversChange={onStopoversChange}
				stopoverDurations={stopoverDurations}
				onStopoverDurationsChange={onStopoverDurationsChange}
				disabled={isJourneyStarted}
			/>

			<JourneyControls
				canStartJourney={canStartJourney}
				onStartJourney={onStartJourney}
				onResetJourney={onResetJourney}
			/>
		</div>
	);
}



