import { useHasWorkflow } from '@open-ent/react';

export function useCanEscalate(): boolean {
  const escalateWorkflow = useHasWorkflow(
    'net.atos.entng.support.controllers.TicketController|escalateTicket',
  ) as boolean;

  return escalateWorkflow;
}
