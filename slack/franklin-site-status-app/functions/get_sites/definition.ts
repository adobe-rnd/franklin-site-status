import {DefineFunction, Schema} from "deno-slack-sdk/mod.ts";
import {SiteType} from '../../types/site.ts';

const GetSitesDefinition = DefineFunction({
  callback_id: "get_sites_function",
  title: "Franklin Status: Get Sites",
  description: "Gets sites from the Franklin Status API",
  source_file: "functions/get_sites/mod.ts",
  output_parameters: {
    properties: {
      sites: {
        type: Schema.types.array,
        items: {
          type: SiteType
        },
      },
    },
    required: ["sites"],
  },
});

export default GetSitesDefinition;
