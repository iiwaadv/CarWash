// Stand-in for the real SMS gateway integration described in the PRD.
// In production, swap the console log for a provider call (e.g. Twilio/Unifonic)
// and/or a push notification to the manager's mobile app. Kept centralized here
// so the rest of the codebase never talks to the SMS provider directly.

interface UrgentAlert {
  title: string;
  message: string;
  jobId?: number;
  incidentId?: number;
}

export const recentAlerts: (UrgentAlert & { sentAt: string })[] = [];

export async function sendUrgentAlert(alert: UrgentAlert): Promise<void> {
  const record = { ...alert, sentAt: new Date().toISOString() };
  recentAlerts.unshift(record);
  if (recentAlerts.length > 50) recentAlerts.pop();
  // eslint-disable-next-line no-console
  console.log(`[SMS-GATEWAY] ${record.title}: ${record.message}`);
}
