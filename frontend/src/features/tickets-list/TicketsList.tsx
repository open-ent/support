import {
  Alert,
  Flex,
  LoadingScreen,
  Pagination,
  useIsAdmlcOrAdmc,
} from '@open-ent/react';
import { EmptyTicketsTable } from './components/EmptyTicketsTable';
import { TicketsFilters } from './components/TicketsFilters';
import { TicketsTable } from './components/TicketsTable';
import { TicketsTypeSelector } from './components/TicketsTypeSelector';
import { useI18n } from '~/hooks/usei18n';
import { useTicketListState } from './hooks/useTicketListState';

export function TicketsList() {
  const { isAdmlcOrAdmc } = useIsAdmlcOrAdmc();
  const {
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
  const { t } = useI18n();

  return (
    <Flex direction="column" gap="12" className="mb-24">
      <TicketsFilters
        schools={schools}
        filters={filters}
        onChange={handleFiltersChange}
      />
      {isAdmlcOrAdmc && (
        <TicketsTypeSelector filters={filters} onChange={handleFiltersChange} />
      )}
      {isPending ? (
        <Flex className="w-100" justify="center" align="center">
          <LoadingScreen />
        </Flex>
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
