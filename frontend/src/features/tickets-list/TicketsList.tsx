import {
  Alert,
  Flex,
  IconButton,
  LoadingScreen,
  Pagination,
  useIsAdmlcOrAdmc,
} from '@open-ent/react';
import { IconTable, IconViewList } from '@open-ent/react/icons';
import { useI18n } from '~/hooks/usei18n';
import { TicketsKanban } from '../tickets-kanban/TicketsKanban';
import { EmptyTicketsTable } from './components/EmptyTicketsTable';
import { TicketsFilters } from './components/TicketsFilters';
import { TicketsTable } from './components/TicketsTable';
import { TicketsTypeSelector } from './components/TicketsTypeSelector';
import { useTicketListState } from './hooks/useTicketListState';

export function TicketsList() {
  const { t } = useI18n();
  const { isAdmlcOrAdmc } = useIsAdmlcOrAdmc();
  const {
    view,
    setView,
    filters,
    page,
    setPage,
    tickets,
    schools,
    ticketsPerPage,
    totalResults,
    isPending,
    isError,
    isTableEmpty,
    handleSort,
    handleFiltersChange,
  } = useTicketListState();
  const isKanban = view === 'kanban';

  return (
    <Flex direction="column" gap="12" className="mb-24">
      <TicketsFilters
        schools={schools}
        filters={filters}
        onChange={handleFiltersChange}
        hideStatusFilter={isKanban}
      />
      <Flex justify="between" align="center" gap="12" wrap="wrap">
        {isAdmlcOrAdmc ? (
          <TicketsTypeSelector
            filters={filters}
            onChange={handleFiltersChange}
          />
        ) : (
          <div />
        )}
        <Flex gap="4" role="group" aria-label={t('support.view.label')}>
          <IconButton
            icon={<IconViewList />}
            variant={isKanban ? 'ghost' : 'outline'}
            color="tertiary"
            aria-label={t('support.view.list')}
            aria-pressed={!isKanban}
            title={t('support.view.list')}
            onClick={() => setView('list')}
            data-testid="view-list"
          />
          <IconButton
            icon={<IconTable />}
            variant={isKanban ? 'outline' : 'ghost'}
            color="tertiary"
            aria-label={t('support.view.kanban')}
            aria-pressed={isKanban}
            title={t('support.view.kanban')}
            onClick={() => setView('kanban')}
            data-testid="view-kanban"
          />
        </Flex>
      </Flex>
      {isPending ? (
        <Flex className="w-100" justify="center" align="center">
          <LoadingScreen />
        </Flex>
      ) : isKanban ? (
        <TicketsKanban filters={filters} schools={schools} />
      ) : isError ? (
        <Alert type="danger" data-load-error>
          {t('support.load.error')}
        </Alert>
      ) : isTableEmpty ? (
        <EmptyTicketsTable />
      ) : (
        <Flex direction="column" gap="4" align="center">
          <TicketsTable
            tickets={tickets}
            schools={schools}
            sortBy={filters.sortBy}
            order={filters.order}
            onSort={handleSort}
          />
          {ticketsPerPage !== undefined && (
            <Pagination
              className="mt-4 mb-24"
              current={page}
              total={totalResults}
              onChange={setPage}
              pageSize={ticketsPerPage}
            />
          )}
        </Flex>
      )}
    </Flex>
  );
}
