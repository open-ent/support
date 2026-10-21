import { describe, expect, it, vi } from 'vitest';

const http = {
  isResponseError: vi.fn(),
  latestResponse: { statusText: 'Forbidden' },
  get: vi.fn(),
};
vi.mock('@open-ent/client', () => ({ odeServices: { http: () => http } }));

import { odeServices, unwrap } from '../../services/api/strictHttp';

describe('strictHttp', () => {
  it('renvoie le résultat quand la réponse est valide', async () => {
    http.isResponseError.mockReturnValue(false);
    await expect(unwrap(Promise.resolve([1]))).resolves.toEqual([1]);
  });

  it("lève sur une réponse d'erreur (ex. création de ticket refusée en 403)", async () => {
    http.isResponseError.mockReturnValue(true);
    await expect(unwrap(Promise.resolve({ error: 'refusé' }))).rejects.toThrow('refusé');
  });

  it('le proxy lève aussi pour un get en erreur', async () => {
    http.isResponseError.mockReturnValue(true);
    http.get.mockResolvedValue(undefined);
    await expect(odeServices.http().get('/x', {})).rejects.toThrow('Forbidden');
  });
});
