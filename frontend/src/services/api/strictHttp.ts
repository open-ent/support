import { odeServices as socle } from '@open-ent/client';

/**
 * Le client HTTP du socle ne lève pas sur une erreur (403/500) : il renvoie la
 * réponse d'erreur, ce qui faisait afficher un succès (ou planter `tickets.map`).
 * `unwrap` lève dès que la dernière réponse est une erreur.
 * Ex. : un ticket refusé en 403 déclenche désormais l'échec côté appelant.
 */
export const unwrap = async <T>(promise: Promise<T>): Promise<T> => {
  const result = await promise;
  const http = socle.http();
  if (http.isResponseError()) {
    const message =
      (result as { error?: string } | undefined)?.error ??
      http.latestResponse?.statusText;
    throw new Error(message || 'http-error');
  }
  return result;
};

/** Même API que `odeServices.http()`, mais chaque appel passe par `unwrap`. */
export const odeServices = {
  http: () =>
    new Proxy(socle.http(), {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== 'function') return value;
        if (prop === 'isResponseError') return value.bind(target);
        return (...args: unknown[]) =>
          unwrap(Promise.resolve(value.apply(target, args)));
      },
    }),
};
