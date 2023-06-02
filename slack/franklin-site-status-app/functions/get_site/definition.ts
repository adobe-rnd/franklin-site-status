import {DefineFunction, Schema} from "deno-slack-sdk/mod.ts";

import {SiteType} from '../../types/site.ts';

const GetSiteDefinition = DefineFunction({
  callback_id: "get_site_function",
  title: "Franklin Status: Get Site",
  description: "Get a site from the Franklin Status API",
  source_file: "functions/get_site/mod.ts",
  input_parameters: {
    properties: {
      domain: {
        type: Schema.types.string,
        description: "Domain of the site to get",
      }
    },
    required: ["domain"],
  },
  output_parameters: {
    properties: {
      site: {
        type: SiteType,
        description: "Site from the Franklin Status API",
      },
    },
    required: ["site"],
  },
});

export default GetSiteDefinition;
