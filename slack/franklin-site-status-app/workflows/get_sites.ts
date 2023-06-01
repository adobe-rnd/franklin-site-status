import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import GetSitesDefinition from '../functions/get_sites/definition.ts';

const GetSitesWorkflow = DefineWorkflow({
  callback_id: "get_sites_workflow",
  title: "Get Sites Workflow",
  description: "Gets sites from the Franklin Status API",
  input_parameters: {
    properties: {
      channel: {
        type: Schema.slack.types.channel_id,
      },
    },
  },
});

const getSitesStep = GetSitesWorkflow.addStep(GetSitesDefinition, {});

GetSitesWorkflow.addStep(Schema.slack.functions.SendMessage, {
  channel_id: GetSitesWorkflow.inputs.channel,
  message: "Sites: " + getSitesStep.outputs.sites,
});

export default GetSitesWorkflow;
