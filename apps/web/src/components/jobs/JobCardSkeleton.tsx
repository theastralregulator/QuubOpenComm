import React from 'react';

interface JobCardSkeletonProps {
  count?: number;
  className?: string;
}

export default function JobCardSkeleton({ count = 1, className = '' }: JobCardSkeletonProps) {
  const skeletons = Array.from({ length: count });

  return (
    <>
      {skeletons.map((_, index) => (
        <div
          key={index}
          className={`bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-2xs animate-pulse ${className}`}
        >
          {/* Header Row */}
          <div>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
                <div className="space-y-1.5">
                  <div className="w-24 h-3.5 bg-slate-200 dark:bg-slate-800 rounded-md" />
                  <div className="w-16 h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
                </div>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800/60" />
                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800/60" />
              </div>
            </div>

            {/* Title Skeleton */}
            <div className="space-y-2 mb-2">
              <div className="w-3/4 h-4 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="w-1/2 h-4 bg-slate-200 dark:bg-slate-800 rounded-md" />
            </div>

            {/* Description Skeleton */}
            <div className="space-y-1.5 mb-4">
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
              <div className="w-5/6 h-3 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
            </div>

            {/* Location & Salary Skeleton */}
            <div className="space-y-2 mb-4">
              <div className="w-2/5 h-3.5 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
              <div className="w-1/3 h-3.5 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
              <div className="w-1/2 h-3.5 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
            </div>

            {/* Tags Skeleton */}
            <div className="flex items-center space-x-2">
              <div className="w-16 h-4 bg-slate-200 dark:bg-slate-800 rounded-full" />
              <div className="w-14 h-4 bg-slate-100 dark:bg-slate-800/60 rounded-full" />
            </div>
          </div>

          {/* Bottom Actions Skeleton */}
          <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/60 grid grid-cols-2 gap-2">
            <div className="h-9 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
            <div className="h-9 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>
      ))}
    </>
  );
}
