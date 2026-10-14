import { useEdificeClient } from '@open-ent/react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { REPORT_CATEGORY } from '~/models';

export type TicketCategory = {
  label: string;
  value: string;
};

export function useTicketCategories(): TicketCategory[] {
  const { applications } = useEdificeClient();
  const { t } = useTranslation();

  const categories = useMemo(() => {
    const seen = new Set<string>(); // used to avoid duplicate categories
    return (applications ?? [])
      .filter((app) => app.address)
      .filter((app) => {
        const normalizedAppName = app.displayName.toLowerCase().trim();
        if (seen.has(normalizedAppName)) return false;
        seen.add(normalizedAppName);
        return true;
      })
      .map((app) => ({ label: t(app.displayName), value: app.address }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [applications, t]);

  // Le signalement de contenu illicite ne dépend d'aucune application : toujours proposé, en tête.
  return useMemo(
    () => [
      { label: t(REPORT_CATEGORY), value: REPORT_CATEGORY },
      ...categories,
    ],
    [categories, t],
  );
}
