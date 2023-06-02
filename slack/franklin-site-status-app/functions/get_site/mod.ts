import { SlackFunction } from "deno-slack-sdk/mod.ts";

import GetSiteDefinition from './definition.ts';
import {validateApiKey} from '../util.ts';

const BASE_API_URL = 'https://franklin-site-status-server.ethos05-prod-va7.ethos.adobe.net/api/sites';
const API_KEY = Deno.env.get('FRANKLIN_SITE_STATUS_API_KEY');

const processSiteData = (site: any) => {
  site.auditError = site.auditError ?? "none";
  site.auditHistory.forEach((audit: any) => {
    audit.errorMessage = audit.errorMessage ?? "none";
  });
};

export default SlackFunction(
  GetSiteDefinition,
  async ({ inputs }) => {
    validateApiKey(API_KEY);

    const siteUrl = `${BASE_API_URL}/${inputs.domain.trim()}`;

    try {
      const response = await fetch(siteUrl, {
        method: "GET",
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': API_KEY,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            outputs: {
              site: {},
            }
          };
        }
        throw new Error(`Error while getting the site from Franklin Status API: ${response.statusText}`);
      }

      const site = await response.json();

      processSiteData(site);

      return {
        outputs: {
          site,
        }
      };
    } catch (e) {
      console.error(e);
      return {
        error: `Error while getting the site from Franklin Status API: ${e}`,
      }
    }
  });
