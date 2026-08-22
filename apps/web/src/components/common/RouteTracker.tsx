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
    } else if (path === '/about') {
      title = 'About OpenComm — Vision, Mission and Platform Purpose';
      metaDescription = 'Learn about OpenComm, its mission, vision, users, features, values, and approach to trusted work connections.';
    } else if (path === '/jobs') {
      title = 'Jobs | OpenComm';
      metaDescription = 'Explore high-paying developer, designer, carpenter, electrician, and specialist job opportunities on OpenComm.';
    } else if (path.startsWith('/jobs/') && resolvedJobId && !path.includes('/applications')) {
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
    } else if (path === '/messages' || path.startsWith('/messages/')) {
      title = 'Messages | OpenComm';
      metaDescription = 'Direct peer-to-peer real-time messaging on OpenComm.';
    } else if (path.includes('/negotiation') || path.startsWith('/hire-requests/') || path.startsWith('/applications/')) {
      title = 'Negotiation | OpenComm';
      metaDescription = 'Terms, deal offer, and negotiation workspace on OpenComm.';
    } else if (path.startsWith('/work-contracts/')) {
      title = 'Work Contract | OpenComm';
      metaDescription = 'Escrow-backed work agreement and contract details on OpenComm.';
    } else if (path === '/profile/my-job-posts') {
      title = 'My Job Posts | OpenComm';
    } else if (path === '/profile/manage-applications') {
      title = 'Manage Applications | OpenComm';
    } else if (path === '/profile/jobs-applied') {
      title = 'Jobs Applied | OpenComm';
    } else if (path.includes('/applications')) {
      title = 'Applications | OpenComm';
    } else if (path === '/profile/hire-requests') {
      title = 'Hire Requests | OpenComm';
    } else if (path === '/profile/notifications') {
      title = 'Notifications | OpenComm';
    } else if (path === '/profile/notification-settings') {
      title = 'Notification Settings | OpenComm';
    } else if (path === '/profile/saved-jobs' || path === '/saved-jobs') {
      title = 'Saved Jobs | OpenComm';
    } else if (path === '/profile/saved-workers' || path === '/saved-workers') {
      title = 'Saved Workers | OpenComm';
    } else if (path === '/settings' || path === '/profile/settings') {
      title = 'Settings | OpenComm';
    } else if (path === '/profile' || path.startsWith('/profile/')) {
      title = 'Profile | OpenComm';
    } else if (path === '/login') {
      title = 'Sign In | OpenComm';
    } else if (path === '/signup') {
      title = 'Create Account | OpenComm';
    } else if (path === '/reset-password') {
      title = 'Reset Password | OpenComm';
    } else if (path === '/verify-email') {
      title = 'Verify Email | OpenComm';
    } else if (path === '/onboarding') {
      title = 'Onboarding | OpenComm';
    } else if (path === '/terms') {
      title = 'Terms of Service | OpenComm';
    } else if (path === '/privacy') {
      title = 'Privacy Policy | OpenComm';
    } else if (path === '/community-guidelines') {
      title = 'Community Guidelines | OpenComm';
    } else if (path === '/cookie-policy') {
      title = 'Cookie Policy | OpenComm';
    } else if (path === '/contact' || path === '/grievance') {
      title = 'Contact & Support | OpenComm';
    } else if (path.startsWith('/admin')) {
      title = 'Admin Control Center | OpenComm';
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
