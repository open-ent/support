import {
  InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  SortableTicketField,
  SortOrder,
  Ticket,
  TicketApiCode,
  TicketType,
} from '~/models';
import {
  getAttachmentById,
  getBugTrackerIssueById,
  getCommentsById,
  getEventsById,
  getTicketById,
  getTickets,
  getTicketsPerPage,
  updateTicketsStatus,
} from '../api';

/**
 * Allows to generate query keys for tickets-related queries
 */
export const ticketsQueryKeys = {
  all: () => ['tickets'] as const,
  lists: () => [ticketsQueryKeys.all(), 'list'] as const,
  ticketsPerPage: () =>
    [ticketsQueryKeys.all(), 'config', 'ticketsPerPage'] as const,
  byId: (ticketId: string) => [ticketsQueryKeys.all(), ticketId] as const,
  byIdWithComment: (ticketId: string) =>
    [ticketsQueryKeys.all(), ticketId, 'comments'] as const,
  byIdWithEvents: (ticketId: string) =>
    [ticketsQueryKeys.all(), ticketId, 'events'] as const,
  attachmentsById: (ticketId: string) =>
    [ticketsQueryKeys.all(), ticketId, 'attachments'] as const,
  list: (
    page?: number,
    status?: TicketApiCode[],
    type?: TicketType,
    schools?: string[],
    search?: string,
    sortBy?: SortableTicketField,
    order?: SortOrder,
  ) =>
    [
      ticketsQueryKeys.all(),
      'list',
      { page, status, type, schools, search, sortBy, order },
    ] as const,
  kanbans: () => [ticketsQueryKeys.all(), 'kanban'] as const,
  kanbanColumn: (
    status: TicketApiCode,
    type: TicketType,
    schools: string[],
    search: string,
    sortBy: SortableTicketField,
    order: SortOrder,
  ) =>
    [
      ...ticketsQueryKeys.kanbans(),
      { status, type, schools, search, sortBy, order },
    ] as const,
  bugTrackerIssue: (ticketId: string | undefined) =>
    [ticketsQueryKeys.all(), ticketId, 'bugTrackerIssue'] as const,
};

export const useTickets = (
  page: number,
  status: TicketApiCode[],
  type: TicketType,
  schools: string[],
  search: string,
  sortBy: SortableTicketField = 'modified',
  order: SortOrder = 'DESC',
) => {
  const { data, isPending, isError } = useQuery({
    queryKey: ticketsQueryKeys.list(
      page,
      status,
      type,
      schools,
      search,
      sortBy,
      order,
    ),
    queryFn: () =>
      getTickets(page, status, type, schools, search, sortBy, order),
  });
  return { tickets: (data as Ticket[]) ?? [], isPending, isError };
};

export const useTicket = (ticketId: string | undefined) => {
  const { data } = useQuery({
    queryKey: ticketsQueryKeys.byId(ticketId!),
    queryFn: () => getTicketById(ticketId!),
    select: (data) => data[0] as Ticket,
    enabled: !!ticketId,
  });
  return data;
};

export const useTicketComments = (ticketId: string | undefined) => {
  const { data } = useQuery({
    queryKey: ticketsQueryKeys.byIdWithComment(ticketId!),
    queryFn: () => getCommentsById(ticketId!),
    select: (data) =>
      [...data].sort(
        (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime(),
      ),
    enabled: !!ticketId,
  });
  return data ?? [];
};

export const useTicketEvents = (ticketId: string | undefined) => {
  const { data } = useQuery({
    queryKey: ticketsQueryKeys.byIdWithEvents(ticketId!),
    queryFn: () => getEventsById(ticketId!),
    select: (data) =>
      [...data].sort(
        (a, b) =>
          new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
      ),
    enabled: !!ticketId,
  });
  return data ?? [];
};

export const useTicketAttachments = (ticketId: string | undefined) => {
  const { data } = useQuery({
    queryKey: ticketsQueryKeys.attachmentsById(ticketId!),
    queryFn: () => getAttachmentById(ticketId!),
    enabled: !!ticketId,
  });
  return data ?? [];
};

export const useBugTrackerIssue = (ticketId: string | undefined) => {
  const { data } = useQuery({
    queryKey: ticketsQueryKeys.bugTrackerIssue(ticketId!),
    queryFn: () => getBugTrackerIssueById(ticketId!),
    enabled: !!ticketId,
  });
  return data;
};

export const useTicketsPerPage = () => {
  const { data, isPending } = useQuery({
    queryKey: ticketsQueryKeys.ticketsPerPage(),
    queryFn: getTicketsPerPage,
    staleTime: Infinity,
  });
  return { ticketsPerPage: data, isPending };
};

/**
 * Tickets of a single status, loaded page by page ("load more") for a kanban column.
 */
export const useKanbanColumnTickets = (
  status: TicketApiCode,
  type: TicketType,
  schools: string[],
  search: string,
  sortBy: SortableTicketField = 'modified',
  order: SortOrder = 'DESC',
) => {
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ticketsQueryKeys.kanbanColumn(
        status,
        type,
        schools,
        search,
        sortBy,
        order,
      ),
      queryFn: ({ pageParam }) =>
        getTickets(pageParam, [status], type, schools, search, sortBy, order),
      initialPageParam: 1,
      getNextPageParam: (lastPage, allPages, lastPageParam) => {
        const loaded = allPages.reduce((sum, page) => sum + page.length, 0);
        const total = lastPage[0]?.total_results ?? 0;
        return lastPage.length > 0 && loaded < total
          ? lastPageParam + 1
          : undefined;
      },
    });
  const pages = (data?.pages ?? []) as Ticket[][];
  return {
    tickets: pages.flat(),
    total: pages[0]?.[0]?.total_results ?? 0,
    isPending,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  };
};

/**
 * Applies a status to several tickets at once (POST /support/ticketstatus/:status).
 * Moved tickets are optimistically removed from the kanban columns they leave.
 */
export const useUpdateTicketsStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: number[]; status: TicketApiCode }) =>
      updateTicketsStatus(ids, status),
    onMutate: async ({ ids, status }) => {
      await queryClient.cancelQueries({ queryKey: ticketsQueryKeys.kanbans() });
      queryClient.setQueriesData<InfiniteData<Ticket[]>>(
        { queryKey: ticketsQueryKeys.kanbans() },
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((page) =>
              page.filter((t) => t.status === status || !ids.includes(t.id)),
            ),
          },
      );
    },
    // Keys are nested under all() (e.g. [['tickets'], 'list', ...]), so this
    // prefix refreshes lists, kanban columns and ticket details alike.
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: [ticketsQueryKeys.all()] }),
  });
};
