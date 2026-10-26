import { Badge, Button, Flex, LoadingScreen } from '@open-ent/react';
import { useDroppable } from '@dnd-kit/core';
import { useI18n } from '~/hooks/usei18n';
import {
  School,
  Ticket,
  TICKET_STATUS_CLASS,
  TicketApiCode,
  TicketFiltersState,
  getTicketStatusText,
} from '~/models';
import { useKanbanColumnTickets } from '~/services/queries/tickets';
import { KanbanCard } from './KanbanCard';

type KanbanColumnProps = {
  status: TicketApiCode;
  filters: TicketFiltersState;
  schoolById: Map<string, School>;
  userScope: string[] | null;
  canMultiSelect: boolean;
  selectedIds: Set<string | number>;
  onToggleSelect: (ticket: Ticket) => void;
  onMove: (ticket: Ticket, status: TicketApiCode) => void;
  // A card is being dragged and cannot be dropped in this column
  isForbiddenTarget: boolean;
};

export function KanbanColumn({
  status,
  filters,
  schoolById,
  userScope,
  canMultiSelect,
  selectedIds,
  onToggleSelect,
  onMove,
  isForbiddenTarget,
}: KanbanColumnProps) {
  const { t } = useI18n();
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    disabled: isForbiddenTarget,
  });
  const {
    tickets,
    total,
    isPending,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useKanbanColumnTickets(
    status,
    filters.type,
    filters.schools,
    filters.search,
    filters.sortBy,
    filters.order,
  );

  return (
    <section
      ref={setNodeRef}
      className={`kanban-column${isOver ? ' kanban-column-over' : ''}${
        isForbiddenTarget ? ' kanban-column-forbidden' : ''
      }`}
      aria-label={t(getTicketStatusText(status))}
      data-testid={`kanban-column-${status}`}
    >
      <Flex justify="between" align="center" className="mb-8">
        <Badge
          className={TICKET_STATUS_CLASS[status]}
          variant={{ type: 'beta' }}
        >
          {t(getTicketStatusText(status))}
        </Badge>
        <strong>{total}</strong>
      </Flex>
      <Flex direction="column" gap="8">
        {isPending ? (
          <LoadingScreen />
        ) : (
          tickets.map((ticket) => (
            <KanbanCard
              key={ticket.id}
              ticket={ticket}
              school={schoolById.get(ticket.school_id)}
              userScope={userScope}
              canMultiSelect={canMultiSelect}
              selected={selectedIds.has(ticket.id)}
              onToggleSelect={onToggleSelect}
              onMove={onMove}
            />
          ))
        )}
        {hasNextPage && (
          <Button
            color="tertiary"
            variant="ghost"
            size="sm"
            isLoading={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            {t('support.kanban.more')}
          </Button>
        )}
      </Flex>
    </section>
  );
}
