import { useCallback, useState } from 'react';
import { SortableTicketField, TicketFiltersState } from '~/models';
import { useSchools } from '~/services/queries/schools';
import { useTickets, useTicketsPerPage } from '~/services/queries/tickets';

const DEFAULT_FILTERS: TicketFiltersState = {
  search: '',
  status: [],
  schools: [],
  type: 'all',
  sortBy: 'modified',
  order: 'DESC',
};

export type TicketsView = 'list' | 'kanban';

const VIEW_STORAGE_KEY = 'support.view';

// Storage may be unavailable (private browsing, blocked site data)
function readStoredView(): TicketsView {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'kanban'
      ? 'kanban'
      : 'list';
  } catch {
    return 'list';
  }
}

export function useTicketListState() {
  const [filters, setFilters] = useState<TicketFiltersState>(DEFAULT_FILTERS);
  const [view, setViewState] = useState<TicketsView>(readStoredView);

  const setView = useCallback((newView: TicketsView) => {
    setViewState(newView);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, newView);
    } catch {
      // The choice simply won't be remembered
    }
  }, []);
  const [page, setPage] = useState(1);

  const {
    tickets,
    isPending: ticketsPending,
    isError,
  } = useTickets(
    page,
    filters.status,
    filters.type,
    filters.schools,
    filters.search,
    filters.sortBy,
    filters.order,
  );
  const { schools, isPending: schoolsPending } = useSchools();
  const { ticketsPerPage, isPending: ticketsPerPagePending } =
    useTicketsPerPage();

  const totalResults = tickets[0]?.total_results ?? 0;
  const isPending = ticketsPending || schoolsPending || ticketsPerPagePending;
  // En cas d'échec de lecture on n'affiche pas le faux « aucune demande »
  const isTableEmpty =
    !isPending &&
    !isError &&
    (!tickets || tickets.length === 0 || schools.length === 0);

  const handleSort = useCallback((field: SortableTicketField) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: field,
      order: prev.sortBy === field && prev.order === 'DESC' ? 'ASC' : 'DESC',
    }));
    setPage(1);
  }, []);

  const handleFiltersChange = useCallback((newFilters: TicketFiltersState) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  return {
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
  };
}
