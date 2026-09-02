/**
 * Non-personal layout diagnostic helper.
 * Collects viewport and screen metrics strictly without user or account data.
 */
export interface MobileLayoutDiagnostic {
  isTouchDevice: boolean;
  layoutWidth: number;
  layoutHeight: number;
  screenWidth: number;
  screenHeight: number;
  dpr: number;
  isDesktopSiteMode: boolean;
  path: string;
}

export function collectMobileLayoutDiagnostic(): MobileLayoutDiagnostic | null {
  if (typeof window === 'undefined') return null;

  const isTouchDevice =
    'ontouchstart' in window ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  const layoutWidth = window.innerWidth;
  const layoutHeight = window.innerHeight;
  const screenWidth = window.screen ? window.screen.width : layoutWidth;
  const screenHeight = window.screen ? window.screen.height : layoutHeight;
  const dpr = window.devicePixelRatio || 1;

  const minScreenDim = Math.min(screenWidth, screenHeight);

  // A physical handheld touch device with a forced desktop layout viewport (> 900px)
  // and physical handheld screen bounds (minScreenDim <= 600) indicates Desktop site mode.
  const isDesktopSiteMode = Boolean(isTouchDevice && layoutWidth > 900 && minScreenDim <= 600);

  const diag: MobileLayoutDiagnostic = {
    isTouchDevice,
    layoutWidth,
    layoutHeight,
    screenWidth,
    screenHeight,
    dpr,
    isDesktopSiteMode,
    path: window.location.pathname
  };

  if (isDesktopSiteMode) {
    console.info('[OpenComm Mobile Diagnostic] Desktop site mode detected on touch device:', diag);
  }

  return diag;
}
