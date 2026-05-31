import React from 'react';
import { cn } from '@/lib/utils';
import FolderInteraction from '@/components/ui/folder-interaction';

interface FolderCardProps {
  onClick: () => void;
  icon?: React.ReactNode;
  title: string;
  stats?: { icon: React.ReactNode; label: string }[];
  badge?: React.ReactNode;
  topRightActions?: React.ReactNode;
  className?: string;
}

const FolderCard: React.FC<FolderCardProps> = ({
  onClick,
  icon,
  title,
  stats,
  badge,
  topRightActions,
  className,
}) => {
  return (
    <FolderInteraction
      className={cn(
        "relative cursor-pointer group",
        className
      )}
    >
      <div onClick={onClick} className="transition-all duration-300 sm:hover:scale-[1.02] active:scale-[0.99]">
        {/* Folder tab */}
        <div
          className="absolute top-0 left-4 w-16 h-4 rounded-t-lg bg-card z-0"
          style={{ transform: 'translateY(-0.85rem)' }}
        />

        {/* Folder body */}
        <div className="relative rounded-xl bg-card overflow-hidden shadow-md group-hover:shadow-xl transition-shadow duration-300 z-10">
          {/* Badge */}
          {badge && (
            <div className="absolute top-2 left-2 z-20">
              {badge}
            </div>
          )}

          {/* Top-right actions */}
          {topRightActions && (
            <div
              className="absolute top-2 right-2 z-20 flex items-center gap-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              {topRightActions}
            </div>
          )}

          {/* Content */}
          <div className="flex flex-col items-center pt-4 pb-2 px-2">
            {icon && (
              <div className="mb-2 flex items-center justify-center p-1 relative z-10">
                {icon}
              </div>
            )}

            <h3 className="font-bold text-sm text-center truncate w-full text-card-foreground">
              {title}
            </h3>

            {stats && stats.length > 0 && (
              <div className="flex flex-col gap-0.5 mt-1.5 text-[11px] text-muted-foreground font-medium">
                {stats.map((stat, idx) => (
                  <span key={idx} className="flex items-center gap-1">
                    {stat.icon}
                    {stat.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </FolderInteraction>
  );
};

export default FolderCard;
