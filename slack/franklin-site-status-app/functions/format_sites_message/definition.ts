import {DefineFunction, Schema} from "deno-slack-sdk/mod.ts";

import {SiteType} from '../../types/site.ts';

const FormatSitesMessageDefinition = DefineFunction({
  callback_id: "format_sites_message_function",
  title: "Format Sites Message",
  description: "Format sites message for Slack",
  source_file: "functions/format_sites_message/mod.ts",
  input_parameters: {
    properties: {
      sites: {
        type: Schema.types.array,
        items: {
          type: SiteType,
        },
        description: "Site from the Franklin Status API",
      }
    },
    required: ["sites"],
  },
  output_parameters: {
    properties: {
      message: {
        type: Schema.types.string,
        description: "Sites message for Slack",
      },
    },
    required: ["message"],
  },
});

export default FormatSitesMessageDefinition;
