export * from "./generated/api";

// Re-export API types, excluding the four request body types that
// would conflict with Zod schema names from "./generated/api".
export type {
  AnalyticsSummary,
  Campaign,
  ClickDataPoint,
  ErrorResponse,
  GetAnalyticsSummaryParams,
  GetClicksOverTimeParams,
  GetLinksParams,
  GetTopLinksParams,
  HealthStatus,
  Link,
  LinkWithClicks,
  QrCodeResponse,
} from "./generated/types";
