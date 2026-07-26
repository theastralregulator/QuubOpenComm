/**
 * Google Analytics 4 Analytics Service for OpenComm
 * Measurement ID: G-3NGJW278WG
 */

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

const MEASUREMENT_ID = 'G-3NGJW278WG';

// Check if we are running in production
const isProd = (import.meta as any).env?.PROD || false;

class AnalyticsService {
  private initialized = false;

  /**
   * Initialize GA4
   */
  init() {
    if (this.initialized) return;

    if (isProd) {
      try {
        // Create script tag for gtag.js
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
        document.head.appendChild(script);

        // Initialize dataLayer and gtag function
        window.dataLayer = window.dataLayer || [];
        window.gtag = function gtag() {
          window.dataLayer.push(arguments);
        };

        // Configure GA
        window.gtag('js', new Date());
        window.gtag('config', MEASUREMENT_ID, {
          send_page_view: false, // We track page views manually/automatically on view state changes
        });

        this.initialized = true;
        console.log(`[Analytics] Google Analytics 4 initialized successfully with ID: ${MEASUREMENT_ID}`);
      } catch (error) {
        console.error('[Analytics] Failed to initialize Google Analytics:', error);
      }
    } else {
      // Development Sandbox logs
      console.log(`[Analytics Sandbox] Initialized successfully with ID: ${MEASUREMENT_ID} (Script load bypassed in development)`);
      this.initialized = true;
    }
  }

  /**
   * Track Page View
   */
  trackPageView(viewName: string) {
    this.init(); // Auto-initialize if not done yet

    const pagePath = `/${viewName}`;
    const pageTitle = viewName.charAt(0).toUpperCase() + viewName.slice(1) + ' | OpenComm';

    if (isProd) {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'page_view', {
          page_title: pageTitle,
          page_path: pagePath,
          send_to: MEASUREMENT_ID,
        });
      }
    } else {
      console.log(`[Analytics Sandbox] Page View Tracked: ${pageTitle} (${pagePath})`);
    }
  }

  /**
   * Track Custom Event
   */
  trackEvent(eventName: string, params: Record<string, any> = {}) {
    this.init(); // Auto-initialize if not done yet

    if (isProd) {
      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, params);
      }
    } else {
      console.log(`[Analytics Sandbox] Event Tracked: "${eventName}"`, params);
    }
  }

  /**
   * Sign Up Event
   */
  trackSignUp(method: string = 'email', userId?: string) {
    this.trackEvent('sign_up', {
      method,
      user_id: userId,
    });
  }

  /**
   * Login Event
   */
  trackLogin(method: string = 'email', userId?: string) {
    this.trackEvent('login', {
      method,
      user_id: userId,
    });
  }

  /**
   * Worker Profile Creation
   */
  trackWorkerProfileCreated(workerData: { profession: string; skills: string[]; rate: number }) {
    this.trackEvent('create_worker_profile', {
      profession: workerData.profession,
      skills: workerData.skills.join(','),
      hourly_rate: workerData.rate,
    });
  }

  /**
   * Employer/Company Profile Creation
   */
  trackEmployerProfileCreated(companyData: { name: string; city: string; state: string }) {
    this.trackEvent('create_employer_profile', {
      company_name: companyData.name,
      location: `${companyData.city}, ${companyData.state}`,
    });
  }

  /**
   * Job Posting
   */
  trackJobPosted(jobData: { title: string; category: string; salary: string }) {
    this.trackEvent('post_job', {
      job_title: jobData.title,
      category: jobData.category,
      salary_range: jobData.salary,
    });
  }

  /**
   * Job Application
   */
  trackJobApplied(jobId: string, coverLetterLength: number) {
    this.trackEvent('apply_job', {
      job_id: jobId,
      cover_letter_length: coverLetterLength,
    });
  }

  /**
   * Search Triggered
   */
  trackSearch(query: string, category?: string) {
    if (!query.trim()) return;
    this.trackEvent('search', {
      search_term: query,
      category: category || 'all',
    });
  }

  /**
   * Chat Opened
   */
  trackChatOpened(contactName: string) {
    this.trackEvent('chat_opened', {
      recipient_name: contactName,
    });
  }

  /**
   * Profile Viewed
   */
  trackProfileViewed(profileType: 'own' | 'worker' | 'public', profileId: string, profileName: string) {
    this.trackEvent('view_profile', {
      profile_type: profileType,
      profile_id: profileId,
      profile_name: profileName,
    });
  }
}

export const analytics = new AnalyticsService();
