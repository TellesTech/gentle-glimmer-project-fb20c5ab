import { motion } from "framer-motion";
import { useState } from "react";

interface FolderInteractionProps {
  children?: React.ReactNode;
  className?: string;
}

function FolderInteraction({ children, className }: FolderInteractionProps) {
  const [isOpen, setIsOpen] = useState(false);

  const pageVariants = {
    spring: { type: "spring" as const, duration: 0.6 },
  };

  return (
    <div className={className}>
      <motion.div
        onHoverStart={() => setIsOpen(true)}
        onHoverEnd={() => setIsOpen(false)}
        className="w-full h-full relative"
      >
        <div className="absolute top-10 inset-x-0 bottom-0 flex items-center justify-center z-30 pointer-events-none">
            {[
              {
                initial: { rotate: -2, x: -14, y: 2 },
                open: { rotate: -7, x: -26, y: -20 },
                transition: {
                  ...pageVariants.spring,
                  bounce: 0.15,
                  stiffness: 160,
                  damping: 22,
                },
                className: "z-10 shadow-md",
              },
              {
                initial: { rotate: 0, x: 0, y: 0 },
                open: { rotate: 1, x: 2, y: -28 },
                transition: {
                  ...pageVariants.spring,
                  duration: 0.55,
                  bounce: 0.12,
                  stiffness: 190,
                  damping: 24,
                },
                className: "z-20 shadow-lg",
              },
              {
                initial: { rotate: 2.5, x: 15, y: 1 },
                open: { rotate: 7, x: 28, y: -22 },
                transition: {
                  ...pageVariants.spring,
                  duration: 0.58,
                  bounce: 0.17,
                  stiffness: 170,
                  damping: 21,
                },
                className: "z-10 shadow-md",
              },
            ].map((page, i) => (
              <motion.div
                key={i}
                initial={page.initial}
                animate={isOpen ? page.open : page.initial}
                transition={page.transition}
                className={`absolute w-7 h-9 rounded-md ${page.className}`}
              style={{ transformOrigin: "bottom center" }}
            >
              <Page />
            </motion.div>
          ))}
        </div>

        <div className="relative z-40 w-full h-full">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

export default FolderInteraction;

const Page = () => (
  <div className="w-full h-full bg-white dark:bg-neutral-200 rounded-sm p-1 border border-neutral-200 dark:border-neutral-300">
    <div className="space-y-0.5">
      <div className="w-3 h-0.5 bg-neutral-300 rounded-full" />
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex gap-0.5">
          <div className="w-2 h-0.5 bg-neutral-200 rounded-full" />
          <div className="w-3 h-0.5 bg-neutral-200 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);
