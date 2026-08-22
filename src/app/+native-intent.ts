type Intent = { path: string; initial: boolean };

/**
 * Decide what the router does with a link the OS handed the app.
 *
 * Google returns from sign in to `com.paayo.ph:/oauthredirect`, and
 * expo-auth-session consumes that itself. The router sees it too -- the bundle
 * identifier is registered as a scheme so the redirect has somewhere to land --
 * and has no route by that name, which is what put "Unmatched Route" on screen
 * behind the sheet. Send it to the root instead, where the session decides.
 */
export function redirectSystemPath({ path }: Intent): string {
    return path.includes('oauthredirect') ? '/' : path;
}
