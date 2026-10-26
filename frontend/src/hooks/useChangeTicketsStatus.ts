import { useToast } from '@open-ent/react';
import { useCallback } from 'react';
import { Ticket, TicketApiCode } from '~/models';
import { useUpdateTicketsStatus } from '~/services/queries/tickets';
import { useI18n } from './usei18n';

/**
 * Moves tickets to a new status and reports the outcome with a toast.
 * Tickets already in the target status are skipped.
 */
export function useChangeTicketsStatus() {
  const { t } = useI18n();
  const toast = useToast();
  const { mutateAsync, isPending } = useUpdateTicketsStatus();

  const changeStatus = useCallback(
    async (tickets: Ticket[], status: TicketApiCode) => {
      const ids = tickets.filter((t) => t.status !== status).map((t) => t.id);
      if (ids.length === 0) return;
      try {
        await mutateAsync({ ids, status });
        toast.success(t('support.ticket.table.status.change.success'));
      } catch (error) {
        console.error(error);
        toast.error(t('support.ticket.table.status.change.error'));
      }
    },
    [mutateAsync, t, toast],
  );

  return { changeStatus, isPending };
}
