import { Navigation, NavigationOff, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface AutoCenterToggleProps {
    autoCenterEnabled: boolean;
    onToggle: () => void;
    className?: string;
    activeIcon?: LucideIcon | ReactNode;
    inactiveIcon?: LucideIcon | ReactNode;
    iconSize?: string;
    enableRotation?: boolean;
}

export default function AutoCenterToggle({ 
    autoCenterEnabled, 
    onToggle, 
    className,
    activeIcon: ActiveIcon = Navigation,
    inactiveIcon: InactiveIcon = NavigationOff,
    iconSize = "h-5 w-5",
    enableRotation = true
}: AutoCenterToggleProps) {
    const renderIcon = (Icon: LucideIcon | ReactNode) => {
        if (typeof Icon === 'function') {
            const IconComponent = Icon as LucideIcon;
            return <IconComponent className={iconSize} />;
        }
        return Icon;
    };

    return (
        <motion.button
            onClick={onToggle}
            className={cn(
                "font-semibold p-4 backdrop-blur-md rounded-full items-center justify-center gap-2 text-white",
                autoCenterEnabled ? 'bg-gray-900/50' : 'bg-gray-500/50',
                className
            )}
            whileHover={{ scale: 1.1, backgroundColor: 'rgba(55, 65, 81, 0.8)' }}
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.2 }}
        >
            <motion.div
                initial={false}
                animate={{ rotate: enableRotation ? (autoCenterEnabled ? 0 : 180) : 0 }}
                transition={{ duration: 0.3 }}
            >
                {autoCenterEnabled ? renderIcon(ActiveIcon) : renderIcon(InactiveIcon)}
            </motion.div>
        </motion.button>
    );
}
