import {Trigger} from "deno-slack-api/types.ts";
import {TriggerContextData, TriggerTypes} from "deno-slack-api/mod.ts";

import GetSitesWorkflow from '../workflows/get_sites.ts';

const getSitesShortcut: Trigger<typeof GetSitesWorkflow.definition> = {
  type: TriggerTypes.Shortcut,
  name: "Franklin Status: Get Sites",
  description: "Get Sites from the Franklin Status API",
  workflow: `#/workflows/${GetSitesWorkflow.definition.callback_id}`,
  inputs: {
    channel: {
      value: TriggerContextData.Shortcut.channel_id,
    },
  },
}

export default getSitesShortcut;
