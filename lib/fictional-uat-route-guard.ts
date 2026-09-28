const DEVICE_ONLY_API_PATHS = new Set([
  "/api/pilot/workspace",
  "/api/pilot/payments",
]);

export function isFictionalUatDeviceApi(path: string) {
  return DEVICE_ONLY_API_PATHS.has(path);
}

export function isFictionalUatPathAllowed(path: string) {
  return path === "/uat"
    || path === "/uat/fictional"
    || path === "/guided-payroll"
    || path.startsWith("/uat/")
    || path.startsWith("/_next/")
    || path.startsWith("/assets/")
    || path === "/favicon.svg";
}
