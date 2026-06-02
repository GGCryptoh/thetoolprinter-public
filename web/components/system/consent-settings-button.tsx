'use client';

import { CONSENT_EVENT } from './consent-manager';

/**
 * Reopens the analytics consent bar so a visitor can change their earlier
 * choice. Used in the footer and on the cookie policy page.
 */
export function ConsentSettingsButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(CONSENT_EVENT))}
      className={className}
    >
      Cookie settings
    </button>
  );
}
