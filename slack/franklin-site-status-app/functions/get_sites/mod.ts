import {SlackFunction} from "deno-slack-sdk/mod.ts";

import GetSitesDefinition from './definition.ts';

export default SlackFunction(
  GetSitesDefinition,
  async ({}) => {
    const headers = {
      Accept: 'application/json',
      'X-API-KEY': Deno.env.get('FRANKLIN_SITE_STATUS_API_KEY'),
    };

    console.debug("headers: ", headers);

    try {
      const response = await fetch(
        'https://franklin-site-status-server.ethos05-prod-va7.ethos.adobe.net/api/sites',
        {headers},
      );

      if (!response.ok) {
        return {
          error:
            `Error while getting sites from Franklin Status API: ${response.statusText}`,
        }
      }

      return {
        outputs: {
          sites: response.json(),
        }
      }
    } catch (e) {
      console.error(e);
      return {
        error:
          `Error while getting sites from Franklin Status API: ${e}`,
      }
    }
  });
