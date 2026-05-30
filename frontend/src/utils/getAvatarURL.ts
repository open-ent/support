import { ID, odeServices } from '@open-ent/client';

export function getAvatarURL(userId: ID): string {
  return odeServices.directory().getAvatarUrl(userId, 'user');
}
