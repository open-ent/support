import {
  AppHeader,
  Breadcrumb,
  Flex,
  Layout,
  LoadingScreen,
  useEdificeClient,
} from '@open-ent/react';
import type { IWebApp } from '@open-ent/client';

import { matchPath, Outlet, useMatch } from 'react-router-dom';

import { AppActionHeader } from '~/features/app/Action/AppActionHeader';
import { setLanguage } from '~/locale';
import { basename } from '..';

/**
 * Application affichée quand le support n'est pas dans `/applications-list`. Cette liste vient des
 * rôles portés par les groupes de l'utilisateur ; le super-admin, rattaché à aucun groupe de
 * profil, ne l'y trouve pas alors que le serveur lui ouvre le support. Sans repli, l'écran restait
 * indéfiniment sur le chargement.
 */
const FALLBACK_APP: IWebApp = {
  name: 'Aide et support',
  displayName: 'support',
  address: '/support',
  prefix: '/support',
  icon: 'support-large',
  display: true,
  isExternal: false,
  scope: [''],
};

/** Check old format URL and redirect if needed */
export const loader = async () => {
  const hashLocation = location.hash.substring(1);

  // Check if the URL is an old format (angular root with hash) and redirect to the new format
  if (hashLocation) {
    const isPath = matchPath('/view/:id', hashLocation);

    if (isPath) {
      // Redirect to the new format
      const redirectPath = `/id/${isPath?.params.id}`;
      location.replace(
        location.origin + basename.replace(/\/$/g, '') + redirectPath,
      );
    }
  }

  return null;
};

export const Component = () => {
  const { init, currentApp: listedApp, currentLanguage } = useEdificeClient();
  const currentApp = listedApp ?? FALLBACK_APP;

  // La locale de formatage des dates suit la langue de la session (cf. locale.ts). Elle est
  // posée pendant le rendu, et non dans un effet : les écrans sont montés sous ce composant
  // et formateraient leurs premières dates en français avant que l'effet ne s'exécute.
  setLanguage(currentLanguage);

  const isTicketDetails = useMatch('tickets/:ticketId');

  if (!init) return <LoadingScreen position={false} />;

  return (
    <Flex className="d-print-block flex-grow-1 vh-100" direction="column">
      <Layout>
        <div className="d-print-none">
          <AppHeader render={AppActionHeader}>
            <Breadcrumb app={currentApp} />
          </AppHeader>
        </div>
        <div
          className={`flex-fill overflow-y-auto ${isTicketDetails ? ' mx-n16' : ''}`}
        >
          <div className="position-relative">
            <Outlet />
          </div>
        </div>
      </Layout>
    </Flex>
  );
};
