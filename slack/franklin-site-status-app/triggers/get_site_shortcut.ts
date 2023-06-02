import { Trigger } from "deno-slack-api/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";

import GetSiteWorkflow from '../workflows/get_site.ts';

const getSiteShortcut: Trigger<typeof GetSiteWorkflow.definition> = {
  type: TriggerTypes.Shortcut,
  name: "Franklin Status: Get Site",
  description: "Get a site from the Franklin Status API",
  workflow: `#/workflows/${GetSiteWorkflow.definition.callback_id}`,
  inputs: {
    interactivity: {
      value: TriggerContextData.Shortcut.interactivity,
    },
    channel: {
      value: TriggerContextData.Shortcut.channel_id,
    },
  },
}

export default getSiteShortcut;
