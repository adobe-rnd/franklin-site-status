import {Manifest} from "deno-slack-sdk/mod.ts";

import GetSitesWorkflow from './workflows/get_sites.ts';
import GetSiteWorkflow from './workflows/get_site.ts';

/**
 * The app manifest contains the app's configuration. This
 * file defines attributes like app name and description.
 * https://api.slack.com/automation/manifest
 */
export default Manifest({
  name: "franklin-site-status-app",
  description: "Obtain Franklin Site Audit Status",
  icon: "assets/default_new_app_icon.png",
  // functions: [GetSitesDefinition, GetSiteDefinition],
  workflows: [GetSitesWorkflow, GetSiteWorkflow],
  outgoingDomains: ["franklin-site-status-server.ethos05-prod-va7.ethos.adobe.net"],
  botScopes: [
    "commands",
    "chat:write",
    "chat:write.public",
    "datastore:read",
    "datastore:write",
  ],
});
