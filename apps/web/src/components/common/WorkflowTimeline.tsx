import React from 'react';
import { Check } from 'lucide-react';

export interface TimelineStep {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'upcoming';
}

interface WorkflowTimelineProps {
  steps: TimelineStep[];
}

export default function WorkflowTimeline({ steps }: WorkflowTimelineProps) {
  return (
    <div className="w-full bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-2xs">
      <div className="flex items-center justify-between relative">
        {steps.map((step, idx) => {
          const isCompleted = step.status === 'completed';
          const isCurrent = step.status === 'current';
          const isLast = idx === steps.length - 1;

          return (
            <div key={step.id} className="flex-1 flex flex-col items-center relative z-10 text-center">
              {/* Step Circle */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                  isCompleted
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : isCurrent
                    ? 'bg-purple-600 text-white ring-4 ring-purple-100 dark:ring-purple-950/50 shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : <span>{idx + 1}</span>}
              </div>

              {/* Step Label */}
              <span
                className={`mt-1.5 text-[10px] sm:text-xs font-bold leading-tight ${
                  isCompleted
                    ? 'text-emerald-700 dark:text-emerald-400 font-extrabold'
                    : isCurrent
                    ? 'text-purple-700 dark:text-purple-300 font-black'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {step.label}
              </span>

              {/* Connecting Line */}
              {!isLast && (
                <div
                  className={`absolute top-3.5 left-[50%] right-[-50%] h-[2px] -z-10 transition-colors ${
                    isCompleted ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function getWorkflowTimelineSteps(
  type: 'hire_request' | 'job_application',
  status: string
): TimelineStep[] {
  if (type === 'hire_request') {
    switch (status) {
      case 'confirmed':
        return [
          { id: '1', label: 'Requested', status: 'completed' },
          { id: '2', label: 'Discussed', status: 'completed' },
          { id: '3', label: 'Confirmed', status: 'completed' },
          { id: '4', label: 'Working', status: 'current' },
        ];
      case 'completed':
        return [
          { id: '1', label: 'Requested', status: 'completed' },
          { id: '2', label: 'Discussed', status: 'completed' },
          { id: '3', label: 'Confirmed', status: 'completed' },
          { id: '4', label: 'Completed', status: 'completed' },
        ];
      case 'proposal_pending':
      case 'changes_requested':
        return [
          { id: '1', label: 'Requested', status: 'completed' },
          { id: '2', label: 'Discussing', status: 'completed' },
          { id: '3', label: 'Agreement', status: 'current' },
          { id: '4', label: 'Working', status: 'upcoming' },
        ];
      case 'negotiating':
        return [
          { id: '1', label: 'Requested', status: 'completed' },
          { id: '2', label: 'Discussing', status: 'current' },
          { id: '3', label: 'Agreement', status: 'upcoming' },
          { id: '4', label: 'Working', status: 'upcoming' },
        ];
      case 'pending':
      default:
        return [
          { id: '1', label: 'Requested', status: 'current' },
          { id: '2', label: 'Discussing', status: 'upcoming' },
          { id: '3', label: 'Agreement', status: 'upcoming' },
          { id: '4', label: 'Working', status: 'upcoming' },
        ];
    }
  } else {
    switch (status) {
      case 'confirmed':
        return [
          { id: '1', label: 'Applied', status: 'completed' },
          { id: '2', label: 'Responded', status: 'completed' },
          { id: '3', label: 'Discussed', status: 'completed' },
          { id: '4', label: 'Confirmed', status: 'current' },
        ];
      case 'completed':
        return [
          { id: '1', label: 'Applied', status: 'completed' },
          { id: '2', label: 'Responded', status: 'completed' },
          { id: '3', label: 'Discussed', status: 'completed' },
          { id: '4', label: 'Completed', status: 'completed' },
        ];
      case 'proposal_pending':
      case 'changes_requested':
        return [
          { id: '1', label: 'Applied', status: 'completed' },
          { id: '2', label: 'Responded', status: 'completed' },
          { id: '3', label: 'Agreement', status: 'current' },
          { id: '4', label: 'Confirmed', status: 'upcoming' },
        ];
      case 'negotiating':
        return [
          { id: '1', label: 'Applied', status: 'completed' },
          { id: '2', label: 'Responded', status: 'completed' },
          { id: '3', label: 'Discussing', status: 'current' },
          { id: '4', label: 'Confirmed', status: 'upcoming' },
        ];
      case 'shortlisted':
        return [
          { id: '1', label: 'Applied', status: 'completed' },
          { id: '2', label: 'Shortlisted', status: 'current' },
          { id: '3', label: 'Discussing', status: 'upcoming' },
          { id: '4', label: 'Confirmed', status: 'upcoming' },
        ];
      case 'pending':
      case 'under_review':
      default:
        return [
          { id: '1', label: 'Applied', status: 'current' },
          { id: '2', label: 'Responded', status: 'upcoming' },
          { id: '3', label: 'Discussing', status: 'upcoming' },
          { id: '4', label: 'Confirmed', status: 'upcoming' },
        ];
    }
  }
}
