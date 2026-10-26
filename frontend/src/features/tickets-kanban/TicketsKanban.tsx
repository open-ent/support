import { Button, Flex, useIsAdmlcOrAdmc } from '@open-ent/react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useCallback, useMemo, useState } from 'react';
import { StatusChangeMenu } from '~/components/StatusChangeMenu';
import { useCanEscalate } from '~/hooks/useCanEscalate';
import { useChangeTicketsStatus } from '~/hooks/useChangeTicketsStatus';
import { useI18n } from '~/hooks/usei18n';
import { useMultiSelect } from '~/hooks/useMultiSelect';
import { useUserScope } from '~/hooks/useUserScope';
import {
  KANBAN_STATUS_ORDER,
  School,
  Ticket,
  TicketApiCode,
  TicketFiltersState,
  getAllowedStatuses,
} from '~/models';
import { KanbanCard } from './components/KanbanCard';
import { KanbanColumn } from './components/KanbanColumn';

const NO_TICKETS: Ticket[] = [];

type TicketsKanbanProps = {
  filters: TicketFiltersState;
  schools: School[];
};

export function TicketsKanban({ filters, schools }: TicketsKanbanProps) {
  const { t } = useI18n();
  const { isAdmlcOrAdmc } = useIsAdmlcOrAdmc();
  const escalateWorkflow = useCanEscalate();
  const canMultiSelect = isAdmlcOrAdmc || escalateWorkflow;
  const userScope = useUserScope();
  const { changeStatus, isPending } = useChangeTicketsStatus();
  const [draggedTicket, setDraggedTicket] = useState<Ticket | null>(null);

  const getTicketId = useCallback((ticket: Ticket) => ticket.id, []);
  const { selected, selectedIds, toggle, clear } = useMultiSelect(
    NO_TICKETS,
    getTicketId,
  );

  const schoolById = useMemo(
    () => new Map(schools.map((s) => [s.id, s])),
    [schools],
  );

  // Small distance so that a simple click still opens the ticket
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const allowedDropTargets = useMemo(
    () =>
      draggedTicket ? getAllowedStatuses([draggedTicket], userScope) : null,
    [draggedTicket, userScope],
  );

  const handleMove = useCallback(
    (ticket: Ticket, status: TicketApiCode) => changeStatus([ticket], status),
    [changeStatus],
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    setDraggedTicket(active.data.current?.ticket ?? null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggedTicket(null);
    const ticket = active.data.current?.ticket as Ticket | undefined;
    if (!ticket || !over) return;
    const status = over.id as TicketApiCode;
    if (getAllowedStatuses([ticket], userScope).includes(status)) {
      handleMove(ticket, status);
    }
  };

  return (
    <Flex direction="column" gap="8" className="w-100">
      {canMultiSelect && selected.length > 0 && (
        <Flex
          align="center"
          gap="16"
          className="tickets-table-toolbar"
          data-testid="kanban-toolbar"
        >
          <span>({selected.length})</span>
          <StatusChangeMenu
            label={t('support.ticket.table.status.change')}
            statuses={getAllowedStatuses(selected, userScope)}
            disabled={isPending}
            onSelect={async (status) => {
              await changeStatus(selected, status);
              clear();
            }}
          />
          <Button color="tertiary" variant="ghost" size="sm" onClick={clear}>
            {t('support.kanban.unselect')}
          </Button>
        </Flex>
      )}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggedTicket(null)}
      >
        <div className="kanban-board">
          {KANBAN_STATUS_ORDER.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              filters={filters}
              schoolById={schoolById}
              userScope={userScope}
              canMultiSelect={canMultiSelect}
              selectedIds={selectedIds}
              onToggleSelect={toggle}
              onMove={handleMove}
              isForbiddenTarget={
                allowedDropTargets !== null &&
                status !== draggedTicket?.status &&
                !allowedDropTargets.includes(status)
              }
            />
          ))}
        </div>
        <DragOverlay>
          {draggedTicket && (
            <KanbanCard
              ticket={draggedTicket}
              school={schoolById.get(draggedTicket.school_id)}
              userScope={userScope}
              canMultiSelect={false}
              selected={false}
              onToggleSelect={toggle}
              onMove={handleMove}
              isOverlay
            />
          )}
        </DragOverlay>
      </DndContext>
    </Flex>
  );
}
