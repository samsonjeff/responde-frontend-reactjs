import { useReports } from '../context/ReportsContext';
import { isReportIncomplete, formatReportCode } from '../services/incidentService';

/**
 * Restores a rejected report back to the review queue.
 * Shared by the review modal and the reports table (which passes its own notify).
 */
export function useRestoreReport(notify: (message: string, type?: 'success' | 'error' | 'info') => void) {
  const { reports, contextUpdateReport } = useReports();
  return async (id: string) => {
    const target = reports.find(r => r.id === id);
    const isIncomplete = target ? isReportIncomplete(target) : false;
    const destination = isIncomplete ? 'Incomplete' : 'Under Review';
    const code = formatReportCode(id, target?.source);
    try {
      const ok = await contextUpdateReport(id, {
        status: 'under_review',
        rejectionReason: null,
        action: `Restored to ${destination}`,
        actionTaken: `Restored to ${destination}`,
      });
      notify(
        ok ? `Report ${code} restored to ${destination}` : `Failed to restore report ${code}. Please try again.`,
        ok ? 'info' : 'error'
      );
    } catch (err) {
      console.error('Failed to persist restore:', err);
      notify(`Failed to restore report ${code}. Please try again.`, 'error');
    }
  };
}
