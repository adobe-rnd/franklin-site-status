import {DefineFunction, Schema} from "deno-slack-sdk/mod.ts";

const GetSitesDefinition = DefineFunction({
  callback_id: "get_sites_function",
  title: "Get Sites",
  description: "Gets sites from the Franklin Status API",
  source_file: "functions/get_sites/mod.ts",
  output_parameters: {
    properties: {
      sites: {
        type: Schema.types.object,
        description: "Sites from the Franklin Status API",
      },
    },
    required: ["sites"],
  },
});

export default GetSitesDefinition;
