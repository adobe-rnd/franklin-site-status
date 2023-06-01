import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";

import GetSiteDefinition from '../functions/get_site/definition.ts';

const GetSiteWorkflow = DefineWorkflow({
  callback_id: "get_site_workflow",
  title: "Get Site Workflow",
  description: "Gets a site from the Franklin Status API",
  input_parameters: {
    properties: {
      interactivity: {
        type: Schema.slack.types.interactivity,
      },
      channel: {
        type: Schema.slack.types.channel_id,
      },
    },
    required: ["interactivity"],
  },
});

const inputForm = GetSiteWorkflow.addStep(
  Schema.slack.functions.OpenForm,
  {
    title: "Get a site by domain",
    interactivity: GetSiteWorkflow.inputs.interactivity,
    submit_label: "Get Site",
    description: "Retrieve audit data for a site",
    fields: {
      elements: [{
        name: "domain",
        title: "Domain",
        description: "Domain of the site to get",
        type: Schema.types.string,
      }],
      required: ["domain"],
    },
  },
);

const getSiteStep = GetSiteWorkflow.addStep(GetSiteDefinition, {
  domain: inputForm.outputs.fields.domain,
});

GetSiteWorkflow.addStep(Schema.slack.functions.SendMessage, {
  channel_id: GetSiteWorkflow.inputs.channel,
  message: "Site: " + getSiteStep.outputs.site,
});

export default GetSiteWorkflow;
