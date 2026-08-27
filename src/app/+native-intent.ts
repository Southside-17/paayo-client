type Intent = { path: string; initial: boolean };

/**
 * The paths a provider returns from sign in on, which are not routes.
 *
 * `oauthredirect` is Google's and `msauth` is Microsoft's. Apple's needs no
 * entry: its return is intercepted by the browser session that opened it and
 * never reaches the router at all.
 */
const OAUTH_RETURNS = ['oauthredirect', 'msauth'];

/**
 * Decide what the router does with a link the OS handed the app.
 */
export function redirectSystemPath({ path }: Intent): string {
    return OAUTH_RETURNS.some((segment) => path.includes(segment)) ? '/' : path;
}
