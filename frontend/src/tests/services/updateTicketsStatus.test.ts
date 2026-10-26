import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn().mockResolvedValue(undefined);

// strictHttp wraps this client and checks isResponseError() after each call
vi.mock('@open-ent/client', () => ({
  odeServices: { http: () => ({ post, isResponseError: () => false }) },
}));

const { updateTicketsStatus } = await import('~/services/api');

describe('updateTicketsStatus', () => {
  beforeEach(() => post.mockClear());

  it('posts the ticket ids to the bulk status endpoint', async () => {
    await updateTicketsStatus([12, 34], 3);
    expect(post).toHaveBeenCalledWith('/support/ticketstatus/3', {
      ids: [12, 34],
    });
  });
});
