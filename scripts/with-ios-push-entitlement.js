const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * Strips the push entitlement expo-notifications adds unless this build may hold it.
 *
 * The package ships an app.plugin.js that prebuild applies from the dependency
 * list alone, so keeping it out of `plugins` in app.config.ts changes nothing --
 * `aps-environment` lands in the entitlements either way. A free Apple Personal
 * Team cannot hold it, and Xcode then refuses to mint a profile at all, so the
 * whole app stops building rather than only push. Same wall as Associated
 * Domains; see .ai/rules/toolchain.md.
 */
function withIosPushEntitlement(config) {
    return withEntitlementsPlist(config, (plist) => {
        if (!process.env.EXPO_PUBLIC_PUSH_IOS) {
            delete plist.modResults['aps-environment'];
        }

        return plist;
    });
};

module.exports = { withIosPushEntitlement };
