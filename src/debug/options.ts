export interface PravahDebugOptions {
  cdpSessions?: boolean;
  traceWait?: boolean;
  profileDomCapture?: boolean;
  structuredSchema?: boolean;
}

let currentDebugOptions: PravahDebugOptions = {};
let debugOptionsEnabled = false;

export function setDebugOptions(
  options?: PravahDebugOptions,
  enabled = false
): void {
  currentDebugOptions = options ?? {};
  debugOptionsEnabled = enabled;
}

export function getDebugOptions(): PravahDebugOptions & { enabled: boolean } {
  return { ...currentDebugOptions, enabled: debugOptionsEnabled };
}
