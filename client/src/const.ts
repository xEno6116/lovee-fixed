// Browser-safe constants shared with the authenticated API client.
export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// This path is intentionally not linked from the public anniversary page.
// Authentication still protects every dashboard and settings request.
export const OWNER_DASHBOARD_PATH = "/loveoffice-console-5h9q2x7m4k8v1r6d3";
export const ownerSettingsPath = (slug: string) => `${OWNER_DASHBOARD_PATH}/site/${slug}/settings`;
