import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";

import GetSitesDefinition from '../functions/get_sites/definition.ts';
import FormatSitesMessageDefinition from '../functions/format_sites_message/definition.ts';


const GetSitesWorkflow = DefineWorkflow({
  callback_id: "get_sites_workflow",
  title: "Franklin Status: Get Sites Workflow",
  description: "Gets sites from the Franklin Status API",
  input_parameters: {
    properties: {
      channel: {
        type: Schema.slack.types.channel_id,
      },
    },
  },
});

GetSitesWorkflow.addStep(Schema.slack.functions.SendMessage, {
  channel_id: GetSitesWorkflow.inputs.channel,
  message: "Fetching list of Franklin Sites ranked by audit scores... please wait",
});

const getSitesStep = GetSitesWorkflow.addStep(GetSitesDefinition, {});

const formatSitesMessageStep = GetSitesWorkflow.addStep(FormatSitesMessageDefinition, {
  sites: getSitesStep.outputs.sites,
});

GetSitesWorkflow.addStep(Schema.slack.functions.SendMessage, {
  channel_id: GetSitesWorkflow.inputs.channel,
  message: formatSitesMessageStep.outputs.message,
});

export default GetSitesWorkflow;
