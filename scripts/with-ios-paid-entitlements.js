const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * The entitlements a dependency writes that only a paid team may hold.
 *
 * `expo-notifications` writes `aps-environment`; `expo-apple-authentication`
 * writes `com.apple.developer.applesignin`. Associated Domains is deliberately
 * not in this list -- that one is ours to ask for, and app.config.ts already
 * withholds it behind the same flag.
 */
const PAID = ['aps-environment', 'com.apple.developer.applesignin'];

/**
 * Strips the paid entitlements dependencies add unless this build may hold them.
 *
 * These packages ship an `app.plugin.js` that prebuild applies **from the
 * dependency list alone**, so keeping them out of `plugins` in app.config.ts
 * changes nothing: the entitlement lands either way, and removing a package from
 * `plugins` does not turn it off. A free Apple Personal Team cannot hold any of
 * them, and Xcode then refuses to mint a profile at all -- so the WHOLE APP stops
 * building rather than only the feature. A `--clean` prebuild does not help; they
 * are regenerated every time.
 *
 * The native modules stay autolinked either way, which is the pairing that
 * matters: the module must be present or the JS import throws on iOS, and the
 * entitlement must be absent or nothing installs. So a teammate with no
 * membership builds and runs exactly as before, with push and Apple sign in
 * hidden by their own support checks rather than broken.
 */
function withIosPaidEntitlements(config) {
    return withEntitlementsPlist(config, (plist) => {
        if (process.env.EXPO_PUBLIC_APPLE_DEVELOPER_PROGRAM) {
            return plist;
        }

        for (const entitlement of PAID) {
            delete plist.modResults[entitlement];
        }

        return plist;
    });
}

module.exports = { withIosPaidEntitlements };
