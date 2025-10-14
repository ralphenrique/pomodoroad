import { Pause, Play, X } from "lucide-react";
import { motion } from "motion/react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/animate-ui/components/radix/alert-dialog";

interface PauseButtonProps {
    isPaused: boolean;
    onPause: () => void;
    onResume: () => void;
    onQuit: () => void;
    isResting?: boolean;
}

export default function PauseButton({ isPaused, onPause, onResume, onQuit, isResting = false }: PauseButtonProps) {
    return (
        <div className="flex gap-3">
            <motion.button
                onClick={isPaused && !isResting ? onResume : onPause}
                disabled={isResting}
                className={`font-semibold p-4 backdrop-blur-md rounded-full items-center justify-center gap-2 ${
                    isResting 
                        ? 'bg-yellow-500/50 cursor-not-allowed'
                        : isPaused
                        ? 'bg-gray-900/50 '
                        : 'bg-gray-500/50 '
                    } text-white`}
                whileHover={!isResting ? { scale: 1.1, backgroundColor: 'rgba(55, 65, 81, 0.8)' } : {}}
                whileTap={!isResting ? { scale: 0.9 } : {}}
                transition={{ duration: 0.2 }}
            >
                {isPaused ? (
                    <Play className="h-5 w-5" />
                ) : (
                    <Pause className="h-5 w-5" />
                )}
            </motion.button>

            {isPaused && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <motion.button
                            className="font-semibold p-4 backdrop-blur-md rounded-full items-center justify-center gap-2 bg-red-600/40 text-white"
                            whileHover={{ scale: 1.1, backgroundColor: 'rgba(220, 38, 38, 0.8)' }}
                            whileTap={{ scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                        >
                            <X className="h-5 w-5" />
                        </motion.button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-gray-900/50 backdrop-blur-md rounded-4xl border-gray-700">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-white">End Journey?</AlertDialogTitle>
                            <AlertDialogDescription className="text-gray-400">
                                This will end your current focus journey. All progress will be lost.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="bg-gray-800 text-white hover:bg-gray-700 border-gray-700">
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={onQuit}
                                className="bg-red-600 text-white hover:bg-red-700"
                            >
                                End Journey
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    );
}
