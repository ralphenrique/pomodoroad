import Markdown from 'react-markdown';
import aboutContent from '@/assets/about.md?raw';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/animate-ui/components/radix/dialog";

interface InfoToggleProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function InfoToggle({ open, onOpenChange }: InfoToggleProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-gray-900/50 rounded-4xl backdrop-blur-md border-gray-700 max-h-[40vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-white">About PomodoRoad</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Turn your focus time into a virtual road trip
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 text-gray-300 overflow-y-auto pr-2 prose prose-invert prose-sm max-w-none">
                    <Markdown>{aboutContent}</Markdown>
                    
                    <div className="mt-6 pt-4 border-t border-gray-700">
                        <h3 className="text-lg font-semibold text-white mb-2">About the Creator</h3>
                        <p className="text-gray-300 mb-3">
                            Created by <span className="font-semibold text-blue-400">Ralph Enrique</span>, a software developer, student leader, cinematographer, & a volunteer
                        </p>
                        <a 
                            href="https://ralphenrique.tech/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            Visit Portfolio →
                        </a>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
