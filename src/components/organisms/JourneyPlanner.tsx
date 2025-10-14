import { cn } from '@/lib/utils';
import { useState } from 'react';
import LocationInputs from '../atoms/LocationInputs';
import JourneyControls from '../molecules/JourneyControls';
import SegmentDurationDisplay from '../molecules/SegmentDurationDisplay';
import type { Location, RouteData } from '../../types';
import { calculateIdealStopovers } from '../../utils/pomodoroHelper';
import { Sparkles } from 'lucide-react';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '../animate-ui/components/radix/alert-dialog';

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
	routeData: RouteData | null;
	origin: Location | null;
	destination: Location | null;
	apiKey: string;
	onShowHelperCircles?: (show: boolean) => void;
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
	routeData,
	origin,
	destination,
	apiKey,
	onShowHelperCircles,
	className,
}: JourneyPlannerProps) {
	const [isAutoSuggesting, setIsAutoSuggesting] = useState(false);
	const [showHelpers, setShowHelpers] = useState(false);
	const [showWarningDialog, setShowWarningDialog] = useState(false);

	// Check if there are any red (non-ideal) segments
	// Only warn if ALL segments are red (no green or yellow segments)
	const hasRedSegments = routeData?.legs ? (() => {
		const hasAnyGreenOrYellow = routeData.legs.some(leg => {
			const minutes = leg.duration / 60;
			return minutes >= 15 && minutes <= 35; // Green (20-30) or Yellow (15-20, 30-35)
		});
		// Only show warning if there are NO green/yellow segments
		return !hasAnyGreenOrYellow;
	})() : false;

	const handleAutoSuggest = async () => {
		if (!origin || !destination) return;

		setIsAutoSuggesting(true);
		try {
			const suggestedStopovers = await calculateIdealStopovers(origin, destination, apiKey);
			if (suggestedStopovers.length > 0) {
				onStopoversChange(suggestedStopovers);
				// Set default 5-minute rest for each stopover
				onStopoverDurationsChange(suggestedStopovers.map(() => 5));
			}
		} catch (error) {
			console.error('Error suggesting stopovers:', error);
		} finally {
			setIsAutoSuggesting(false);
		}
	};

	const handleToggleHelpers = () => {
		const newValue = !showHelpers;
		setShowHelpers(newValue);
		onShowHelperCircles?.(newValue);
	};

	const handleStartClick = () => {
		if (hasRedSegments) {
			setShowWarningDialog(true);
		} else {
			onStartJourney();
		}
	};

	const handleConfirmStart = () => {
		setShowWarningDialog(false);
		onStartJourney();
	};

	const canAutoSuggest = origin && destination && !isJourneyStarted && stopovers.length === 0;
	const canShowHelpers = origin && destination && !isJourneyStarted && stopovers.length === 0 && routeData;

	return (
		<div className={cn('space-y-4', className)}>
			<h2 className="text-xl font-semibold mb-4">PomodoRoad Trip Editor</h2>

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
				hasOrigin={!!origin}
				hasDestination={!!destination}
			/>

			{/* Auto-suggest and Helper Circles Buttons */}
			{(canAutoSuggest || canShowHelpers) && (
				<div className="flex gap-2">
					{canAutoSuggest && (
						<button
							onClick={handleAutoSuggest}
							disabled={isAutoSuggesting || isJourneyStarted}
							className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-2xl text-blue-400 hover:text-blue-300 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isAutoSuggesting ? (
								<>
									<div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
									<span>Calculating...</span>
								</>
							) : (
								<>
									<Sparkles className="w-4 h-4" />
									<span>Auto-suggest Stops</span>
								</>
							)}
						</button>
					)}
					{canShowHelpers && (
						<button
							onClick={handleToggleHelpers}
							className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-2xl text-sm transition-all ${
								showHelpers
									? 'bg-purple-600/20 border border-purple-500/30 text-purple-400 hover:text-purple-300'
									: 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-white'
							}`}
						>
							<span className="text-md">📍</span>
							<span>{showHelpers ? 'Hide' : 'Show'} Suggest Stops</span>
						</button>
					)}
				</div>
			)}

			{routeData?.legs && routeData.legs.length > 0 && (
				<SegmentDurationDisplay 
					legs={routeData.legs} 
					stopovers={stopovers}
				/>
			)}

			<JourneyControls
				canStartJourney={canStartJourney}
				onStartJourney={handleStartClick}
				onResetJourney={onResetJourney}
			/>

			{/* Warning Dialog for Red Segments */}
			<AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Non-Ideal Travel Segments Detected</AlertDialogTitle>
						<AlertDialogDescription>
							Your route contains segments that are too short (&lt;15 min) or too long (&gt;35 min) for optimal Pomodoro focus sessions.
							<br /><br />
							For the best focus experience, aim for 20-30 minute segments. Consider adjusting your stopovers or using the "Auto-suggest Stops" feature.
							<br /><br />
							Are you sure you want to proceed with this travel plan?
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleConfirmStart}>
							Proceed Anyway
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}



