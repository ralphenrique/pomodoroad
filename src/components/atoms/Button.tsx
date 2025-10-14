import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface ButtonProps {
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'warning';
  className?: string;
  children: React.ReactNode;
}

export default function Button({ 
  onClick, 
  disabled = false, 
  variant = 'primary',
  className = '',
  children 
}: ButtonProps) {
  const baseStyles = "font-semibold py-3 px-3 rounded-lg";
  
  const variantStyles = {
    primary: "bg-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white",
    secondary: "bg-gray-700 text-white",
    warning: "bg-yellow-600 text-white"
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={cn(baseStyles, variantStyles[variant], className)}
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.button>
  );
}
