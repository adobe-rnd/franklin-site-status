import { DefineType, Schema } from "deno-slack-sdk/mod.ts";

export const ScoresType = DefineType({
  name: "Scores",
  type: Schema.types.object,
  properties: {
    accessibility: {
      type: Schema.types.number,
    },
    bestPractices: {
      type: Schema.types.number,
    },
    performance: {
      type: Schema.types.number,
    },
    seo: {
      type: Schema.types.number,
    }
  },
  //required: ["accessibility", "bestPractices", "performance", "seo"],
});

export const AuditType = DefineType({
  name: "Audit",
  type: Schema.types.object,
  properties: {
    auditedAt: {
      type: Schema.types.string,
    },
    isError: {
      type: Schema.types.boolean,
    },
    errorMessage: {
      type: Schema.types.string,
    },
    scores: {
      type: ScoresType,
    }
  }
});

export const SiteType = DefineType({
  name: "Site",
  type: Schema.types.object,
  properties: {
    domain: {
      type: Schema.types.string,
    },
    githubUrl: {
      type: Schema.types.string,
    },
    lastAudited: {
      type: Schema.types.string,
    },
    auditError: {
      type: Schema.types.string,
    },
    audits: {
      type: Schema.types.array,
      items: {
        type: AuditType,
      },
    },
  },
  //required: ["domain", "githubUrl", "lastAudited"],
});
