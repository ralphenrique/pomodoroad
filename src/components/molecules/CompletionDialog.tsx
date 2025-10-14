import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '../animate-ui/components/radix/alert-dialog';

interface CompletionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete: () => void;
}

export default function CompletionDialog({
    open,
    onOpenChange,
    onComplete,
}: CompletionDialogProps) {
    const handleContinue = () => {
        onComplete();
        onOpenChange(false);
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="bg-gray-900/60 rounded-4xl backdrop-blur-md border-gray-700/50">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-3xl font-bold text-center mb-2 text-white">
                        Touch Down!
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-gray-300 text-center text-lg">
                        Congratulations! You've successfully completed your focus session.
                        <br />
                        {/* <span className="text-blue-400 font-semibold mt-2 block">
              Great job staying focused!
            </span> */}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="sm:justify-center">
                    <AlertDialogAction
                        onClick={handleContinue}
                        className=" text-white px-8 py-3 rounded-lg bg-blue-500 font-semibold transition-all duration-200 transform hover:scale-105 hover:bg-blue-600"
                    >
                        Return to Home
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
