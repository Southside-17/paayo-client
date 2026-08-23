type Intent = { path: string; initial: boolean };

/**
 * Decide what the router does with a link the OS handed the app.
 */
export function redirectSystemPath({ path }: Intent): string {
    return path.includes('oauthredirect') ? '/' : path;
}
