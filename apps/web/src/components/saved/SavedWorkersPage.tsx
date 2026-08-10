import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Inbox } from 'lucide-react';
import { Worker } from '../../types';
import WorkerCard from '../cards/WorkerCard';

interface SavedWorkersPageProps {
  workers: Worker[];
  toggleWorkerBookmark: (id: string, e: React.MouseEvent) => void;
  onOpenMessage: (name: string) => void;
  onOpenHire: (worker: Worker, e: React.MouseEvent) => void;
  onExplore: () => void;
}

export default function SavedWorkersPage({
  workers,
  toggleWorkerBookmark,
  onOpenMessage,
  onOpenHire,
  onExplore,
}: SavedWorkersPageProps) {
  const navigate = useNavigate();
  const savedList = workers.filter(w => (w as any).bookmarked);

  return (
    <div className="w-full text-left" id="saved-workers-container">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white flex items-center">
          <Bookmark className="w-7 h-7 mr-2.5 text-purple-500 fill-current" />
          Saved Professionals
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Keep track of local skilled providers and contractors you have bookmarked.
        </p>
      </div>

      {savedList.length === 0 ? (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449] rounded-2xl p-12 text-center max-w-lg mx-auto mt-8 shadow-xs">
          <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 mx-auto mb-4">
            <Inbox className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">You have not saved any workers yet.</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-6">
            Explore the workers directory to bookmark professionals for future projects.
          </p>
          <button 
            onClick={onExplore}
            className="px-5 py-2.5 bg-[#6C4DFF] hover:bg-[#5b3ee0] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            Explore Directory
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 w-full">
          {savedList.map((worker) => (
            <WorkerCard
              key={worker.id}
              id={worker.id}
              name={worker.name}
              avatarUrl={worker.photo}
              verified={worker.verified}
              professionalTitle={worker.title}
              rating={worker.rating}
              experienceYears={worker.experience}
              hourlyRate={worker.hourlyRate}
              shortBio={worker.bio}
              location={worker.location}
              availability={worker.availability}
              saved={true}
              onSave={toggleWorkerBookmark}
              onViewProfile={() => navigate(`/workers/${worker.id}`)}
              onMessage={() => navigate(`/workers/${worker.id}`)}
              onHire={() => navigate(`/workers/${worker.id}`)}
              showHireButton={true}
              showMessageButton={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
