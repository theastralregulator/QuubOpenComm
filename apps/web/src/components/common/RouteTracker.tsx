import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Job, Worker } from '../../types';

interface RouteTrackerProps {
  jobs: Job[];
  workers: Worker[];
}

export default function RouteTracker({ jobs, workers }: RouteTrackerProps) {
  const location = useLocation();
  const params = useParams();

  useEffect(() => {
    let title = 'OpenComm — Jobs, Professionals and Work Opportunities';
    let metaDescription = 'Discover jobs, skilled professionals, and trusted work opportunities on OpenComm.';
    const path = location.pathname;

    const jobMatch = path.match(/^\/jobs\/([^/]+)/);
    const resolvedJobId = params.jobId || (jobMatch ? jobMatch[1] : null);

    const workerMatch = path.match(/^\/workers\/([^/]+)/);
    const resolvedWorkerId = params.workerId || (workerMatch ? workerMatch[1] : null);

    if (path === '/') {
      title = 'OpenComm — Jobs, Professionals and Work Opportunities';
    } else if (path === '/jobs') {
      title = 'Jobs | OpenComm';
      metaDescription = 'Explore high-paying developer, designer, carpenter, electrician, and specialist job opportunities on OpenComm.';
    } else if (path.startsWith('/jobs/') && resolvedJobId) {
      const job = jobs.find(j => j.id === resolvedJobId);
      title = job ? `${job.title} at ${job.company} | OpenComm` : 'Job Details | OpenComm';
      if (job) {
        metaDescription = `Apply to ${job.title} at ${job.company} offering ${job.salary}. Requirements: ${job.requirements?.join(', ') || ''}`;
      }
    } else if (path === '/workers') {
      title = 'Workers | OpenComm';
      metaDescription = 'Browse verified contractors, developers, designer, and local workers available for direct escrow-backed hire.';
    } else if (path.startsWith('/workers/') && resolvedWorkerId) {
      const worker = workers.find(w => w.id === resolvedWorkerId);
      title = worker ? `${worker.name} - ${worker.title} | OpenComm` : 'Worker Profile | OpenComm';
      if (worker) {
        metaDescription = `Hire ${worker.name}, a certified ${worker.title} with ${worker.experience} years of experience. Hourly rate: $${worker.hourlyRate}/hr.`;
      }
    } else if (path === '/messages') {
      title = 'Messages | OpenComm';
    } else if (path === '/profile') {
      title = 'My Profile | OpenComm';
    } else if (path === '/saved-jobs') {
      title = 'Saved Jobs | OpenComm';
    } else if (path === '/saved-workers') {
      title = 'Saved Workers | OpenComm';
    } else if (path === '/login') {
      title = 'Sign In | OpenComm';
    } else if (path === '/signup') {
      title = 'Create Account | OpenComm';
    } else if (path === '/onboarding') {
      title = 'Onboarding | OpenComm';
    } else if (path === '/settings') {
      title = 'Settings | OpenComm';
    } else {
      title = 'Page Not Found | OpenComm';
    }

    document.title = title;

    // Update Meta Description
    try {
      let metaDescEl = document.querySelector('meta[name="description"]');
      if (!metaDescEl) {
        metaDescEl = document.createElement('meta');
        metaDescEl.setAttribute('name', 'description');
        document.head.appendChild(metaDescEl);
      }
      metaDescEl.setAttribute('content', metaDescription);
    } catch (e) {
      console.warn('Failed to update meta description tag:', e);
    }

    // GA page view event
    const isProd = (import.meta as any).env?.PROD || false;
    if (isProd) {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'page_view', {
          page_title: title,
          page_path: path,
          page_location: window.location.href,
          send_to: 'G-3NGJW278WG',
        });
      }
    } else {
      console.log(`[Analytics Sandbox] Route Change Page View Tracked: ${title} (${path}) with Description: "${metaDescription}"`);
    }
  }, [location.pathname, params, jobs, workers]);

  return null;
}
