// Types for checking whether the extension is available to be used by the web app

export const CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK = 'extension.availabilityCheck' as const;
export const CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK_RESPONSE = 'extension.availabilityCheck.response' as const;

export const ExtensionAvailabilityKind = {
  UNAVAILABLE: 'UNAVAILABLE',
  AVAILABLE_UNAUTH: 'AVAILABLE_UNAUTH',
  AVAILABLE_AUTH: 'AVAILABLE_AUTH',
} as const;

export type ExtensionAvailabilityKind = (typeof ExtensionAvailabilityKind)[keyof typeof ExtensionAvailabilityKind];

export type ExtensionAvailability =
  | { kind: typeof ExtensionAvailabilityKind.UNAVAILABLE; reason: string }
  | { kind: typeof ExtensionAvailabilityKind.AVAILABLE_UNAUTH; error?: string }
  | { kind: typeof ExtensionAvailabilityKind.AVAILABLE_AUTH };

export type ContentScriptEventExtensionAvailabilityCheckResponse = {
  type: typeof CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK_RESPONSE;
  extensionAvailability: ExtensionAvailability
};

export namespace ContentScriptEventExtensionAvailabilityCheckResponse {
  export const makeUnavailable = (reason: string): ContentScriptEventExtensionAvailabilityCheckResponse => ({
    type: CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK_RESPONSE,
    extensionAvailability: { kind: ExtensionAvailabilityKind.UNAVAILABLE, reason },
  });
  export const makeAvailableUnauth = (error?: string): ContentScriptEventExtensionAvailabilityCheckResponse => ({
    type: CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK_RESPONSE,
    extensionAvailability: { kind: ExtensionAvailabilityKind.AVAILABLE_UNAUTH, error },
  });
  export const makeAvailableAuth = (): ContentScriptEventExtensionAvailabilityCheckResponse => ({
    type: CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK_RESPONSE,
    extensionAvailability: { kind: ExtensionAvailabilityKind.AVAILABLE_AUTH },
  });
}

// Types for checking whether we are authenticated with Supabase

export const SW_EVENT_AUTH_IS_AUTHENTICATED = 'auth.isAuthenticated' as const;

export const ExtensionAuthStatusKind = {
  UNAVAILABLE: 'UNAVAILABLE',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  AUTHENTICATED: 'AUTHENTICATED',
} as const;

export type ExtensionAuthStatusKind = (typeof ExtensionAuthStatusKind)[keyof typeof ExtensionAuthStatusKind];

export type ExtensionAuthStatus =
  | { kind: typeof ExtensionAvailabilityKind.UNAVAILABLE; error: string }
  | { kind: typeof ExtensionAuthStatusKind.UNAUTHENTICATED }
  | { kind: typeof ExtensionAuthStatusKind.AUTHENTICATED };

export type ServiceWorkerEventAuthIsAuthenticatedResponse = {
  type: typeof SW_EVENT_AUTH_IS_AUTHENTICATED;
  extensionAuthStatus: ExtensionAuthStatus
}

export namespace ServiceWorkerEventAuthIsAuthenticatedResponse {
  export const makeUnavailable = (error: string): ServiceWorkerEventAuthIsAuthenticatedResponse => ({
    type: SW_EVENT_AUTH_IS_AUTHENTICATED,
    extensionAuthStatus: { kind: ExtensionAuthStatusKind.UNAVAILABLE, error },
  });
  export const makeUnauthenticated = (): ServiceWorkerEventAuthIsAuthenticatedResponse => ({
    type: SW_EVENT_AUTH_IS_AUTHENTICATED,
    extensionAuthStatus: { kind: ExtensionAuthStatusKind.UNAUTHENTICATED },
  });
  export const makeAuthenticated = (): ServiceWorkerEventAuthIsAuthenticatedResponse => ({
    type: SW_EVENT_AUTH_IS_AUTHENTICATED,
    extensionAuthStatus:  { kind: ExtensionAuthStatusKind.AUTHENTICATED },
  });
}

// Other events

/// Fired by the extension when logging in or out
export const CONTENT_SCRIPT_EVENT_EXTENSION_STATUS_CHANGED = 'extension.statusChanged' as const;
