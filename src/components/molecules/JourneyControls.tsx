import Button from '../atoms/Button';
import { RefreshCcw } from 'lucide-react';
interface JourneyControlsProps {
  canStartJourney: boolean;
  onStartJourney: () => void;
  onResetJourney: () => void;
}

export default function JourneyControls({
  canStartJourney,
  onStartJourney,
  onResetJourney
}: JourneyControlsProps) {
  return (
    <div className="flex gap-3 pt-4">
      <Button
        onClick={onStartJourney}
        disabled={!canStartJourney}
        variant="primary"
        className="flex-1"
      >
        Start Road Trip
      </Button>
      
      <Button
        onClick={onResetJourney}
        variant="secondary"
      >
        <RefreshCcw />
      </Button>
    </div>
  );
}
