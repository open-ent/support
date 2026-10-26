import { Checkbox, Flex } from '@open-ent/react';
import { useDraggable } from '@dnd-kit/core';
import { memo, SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StatusChangeMenu } from '~/components/StatusChangeMenu';
import { useI18n } from '~/hooks/usei18n';
import {
  ESCALATION_STATUS,
  School,
  Ticket,
  TicketApiCode,
  getAllowedStatuses,
} from '~/models';
import { formatDate } from '~/utils';

type KanbanCardProps = {
  ticket: Ticket;
  school?: School;
  userScope: string[] | null;
  canMultiSelect: boolean;
  selected: boolean;
  onToggleSelect: (ticket: Ticket) => void;
  onMove: (ticket: Ticket, status: TicketApiCode) => void;
  // Rendered inside the DragOverlay: no drag handlers, no interactive controls
  isOverlay?: boolean;
};

// Keeps clicks and keys on inner controls from opening the ticket or starting a drag
const stopPropagation = (e: SyntheticEvent) => e.stopPropagation();

type KanbanCardBodyProps = Omit<KanbanCardProps, 'isOverlay'> & {
  isOverlay: boolean;
};

function KanbanCardBody({
  ticket,
  school,
  userScope,
  canMultiSelect,
  selected,
  onToggleSelect,
  onMove,
  isOverlay,
}: KanbanCardBodyProps) {
  const { t } = useI18n();

  const moveTargets = getAllowedStatuses([ticket], userScope).filter(
    (status) => status !== ticket.status,
  );

  return (
    <>
      <Flex justify="between" align="center" gap="8">
        <Flex align="center" gap="8">
          {canMultiSelect && !isOverlay && (
            <div onClick={stopPropagation} onKeyDown={stopPropagation}>
              <Checkbox
                checked={selected}
                onChange={() => onToggleSelect(ticket)}
                aria-label={`#${ticket.id}`}
              />
            </div>
          )}
          <small className="text-gray-700">#{ticket.id}</small>
        </Flex>
        {ticket.escalation_status === ESCALATION_STATUS.SUCCESSFUL && (
          <small className="text-escalated">
            {t('support.ticket.table.last.update.of.escalated.ticket')}
          </small>
        )}
      </Flex>

      <Link
        to={`/tickets/${ticket.id}`}
        className="kanban-card-subject"
        onClick={stopPropagation}
        onKeyDown={stopPropagation}
      >
        {ticket.subject}
      </Link>

      <small className="d-block text-gray-700">
        {[ticket.category_label, school?.name].filter(Boolean).join(' · ')}
      </small>
      <small className="d-block text-gray-700">
        {ticket.owner_name} · {formatDate(ticket.modified)}
      </small>

      <Flex justify="between" align="center" className="mt-4">
        <small className="text-gray-700">
          {t('support.ticket.table.event.count')} : {ticket.event_count}
        </small>
        {!isOverlay && moveTargets.length > 0 && (
          <div onClick={stopPropagation} onKeyDown={stopPropagation}>
            <StatusChangeMenu
              label={t('support.kanban.move')}
              statuses={moveTargets}
              onSelect={(status) => onMove(ticket, status)}
            />
          </div>
        )}
      </Flex>
    </>
  );
}

export const KanbanCard = memo(function KanbanCard({
  isOverlay = false,
  ...props
}: KanbanCardProps) {
  if (isOverlay) {
    return (
      <div className="kanban-card kanban-card-overlay">
        <KanbanCardBody {...props} isOverlay />
      </div>
    );
  }
  return <DraggableKanbanCard {...props} />;
});

function DraggableKanbanCard(props: Omit<KanbanCardProps, 'isOverlay'>) {
  const { ticket } = props;
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: ticket.id,
    data: { ticket },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`kanban-card${isDragging ? ' kanban-card-dragging' : ''}`}
      onClick={() => navigate(`/tickets/${ticket.id}`)}
      data-testid={`kanban-card-${ticket.id}`}
    >
      <KanbanCardBody {...props} isOverlay={false} />
    </div>
  );
}
