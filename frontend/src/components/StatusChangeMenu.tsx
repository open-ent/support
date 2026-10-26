import { Dropdown } from '@open-ent/react';
import { IconEdit } from '@open-ent/react/icons';
import { TicketApiCode, getTicketStatusText } from '~/models';
import { useI18n } from '~/hooks/usei18n';

type StatusChangeMenuProps = {
  label: string;
  statuses: TicketApiCode[];
  onSelect: (status: TicketApiCode) => void;
  disabled?: boolean;
};

/**
 * Dropdown listing the statuses a set of tickets can be moved to.
 * Shared by the list toolbar (bulk action) and the kanban cards ("move to").
 */
export function StatusChangeMenu({
  label,
  statuses,
  onSelect,
  disabled,
}: StatusChangeMenuProps) {
  const { t } = useI18n();

  return (
    <Dropdown>
      <Dropdown.Trigger
        variant="ghost"
        size="sm"
        icon={<IconEdit />}
        label={label}
        disabled={disabled || statuses.length === 0}
      />
      <Dropdown.Menu>
        {statuses.map((status) => (
          <Dropdown.Item key={status} onClick={() => onSelect(status)}>
            {t(getTicketStatusText(status))}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}
