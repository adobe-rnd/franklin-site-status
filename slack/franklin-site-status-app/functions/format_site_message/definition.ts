import {DefineFunction, Schema} from "deno-slack-sdk/mod.ts";

import {SiteType} from '../../types/site.ts';

const FormatSiteMessageDefinition = DefineFunction({
  callback_id: "format_site_message_function",
  title: "Format Site Message",
  description: "Format a site message for Slack",
  source_file: "functions/format_site_message/mod.ts",
  input_parameters: {
    properties: {
      site: {
        type: SiteType,
        description: "Site from the Franklin Status API",
      }
    },
    required: ["site"],
  },
  output_parameters: {
    properties: {
      message: {
        type: Schema.types.string,
        description: "Site message for Slack",
      },
    },
    required: ["message"],
  },
});

export default FormatSiteMessageDefinition;
