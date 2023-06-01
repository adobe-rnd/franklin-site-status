import {SlackFunction} from "deno-slack-sdk/mod.ts";

import GetSitesDefinition from './definition.ts';
import validateApiKey from '../util.ts';

const API_URL = 'https://franklin-site-status-server.ethos05-prod-va7.ethos.adobe.net/api/sites';
const API_KEY = Deno.env.get('FRANKLIN_SITE_STATUS_API_KEY');

export default SlackFunction(
  GetSitesDefinition,
  async () => {
    console.debug("X-API-KEY: ", API_KEY);
    validateApiKey(API_KEY);

    try {
      const response = await fetch(API_URL, {
        method: "GET",
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(`Error while getting sites from Franklin Status API: ${response.statusText}`);
      }

      return {
        outputs: {
          sites: await response.json(),
        },
      }
    } catch (e) {
      console.error(e);
      return {
        error: `Error while getting sites from Franklin Status API: ${e}`,
      }
    }
  });
