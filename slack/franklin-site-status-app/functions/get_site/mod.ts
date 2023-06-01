import { SlackFunction } from "deno-slack-sdk/mod.ts";
import GetSiteDefinition from './definition.ts';
import validateApiKey from '../util.ts';

const BASE_API_URL = 'https://franklin-site-status-server.ethos05-prod-va7.ethos.adobe.net/api/sites';
const API_KEY = Deno.env.get('FRANKLIN_SITE_STATUS_API_KEY');

export default SlackFunction(
  GetSiteDefinition,
  async ({ inputs }) => {
    console.debug("X-API-KEY: ", API_KEY);
    validateApiKey(API_KEY);

    const siteUrl = `${BASE_API_URL}/${inputs.domain}`;

    try {
      const response = await fetch(siteUrl, {
        method: "GET",
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(`Error while getting the site from Franklin Status API: ${response.statusText}`);
      }

      return {
        outputs: {
          site: await response.json(),
        }
      }
    } catch (e) {
      console.error(e);
      return {
        error: `Error while getting the site from Franklin Status API: ${e}`,
      }
    }
  });
