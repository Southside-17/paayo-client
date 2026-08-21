const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

/**
 * TEMPORARY. Delete this whole file when expo/expo#46663 lands, then drop the
 * two lines in app.config.ts that import and apply it. Nothing else references
 * it, and ios/ is regenerated, so removal needs no cleanup.
 *
 * iOS 27 refuses to launch an app that builds its own UIWindow in
 * didFinishLaunchingWithOptions. Expo's template still does, so this moves the
 * React Native boot into a scene and declares the manifest UIKit looks for.
 */

/** The eager window setup iOS 27 refuses to launch. */
const EAGER_WINDOW = /#if os\(iOS\) \|\| os\(tvOS\)\n[\s\S]*?#endif\n/;

const DEFERRED_WINDOW = `    storedLaunchOptions = launchOptions
`;

const DEFERRED_START = `  var storedLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?

  func startReactNative(in window: UIWindow) {
    self.window = window
    reactNativeFactory?.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: storedLaunchOptions)
  }

`;

const SCENE_DELEGATE = `
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate
    else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.startReactNative(in: window)

    open(connectionOptions.urlContexts)
  }

  func scene(_ scene: UIScene, openURLContexts urlContexts: Set<UIOpenURLContext>) {
    open(urlContexts)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in })
  }

  private func open(_ urlContexts: Set<UIOpenURLContext>) {
    for context in urlContexts {
      RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
  }
}
`;

const SCENE_MANIFEST = {
    UIApplicationSupportsMultipleScenes: false,
    UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
            {
                UISceneConfigurationName: 'Default Configuration',
                UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
            },
        ],
    },
};

/** Boots React Native from a scene, which iOS 27 requires. */
function withIosSceneLifecycle(config) {
    const withManifest = withInfoPlist(config, (infoPlist) => {
        infoPlist.modResults.UIApplicationSceneManifest = SCENE_MANIFEST;

        return infoPlist;
    });

    return withAppDelegate(withManifest, (appDelegate) => {
        const { contents } = appDelegate.modResults;

        if (contents.includes('class SceneDelegate')) {
            return appDelegate;
        }

        if (!EAGER_WINDOW.test(contents)) {
            throw new Error(
                'AppDelegate.swift no longer creates the window where this plugin expects it. ' +
                    'Expo may have adopted scenes upstream -- check expo/expo#46663, and if so ' +
                    'delete scripts/with-ios-scene-lifecycle.js and its use in app.config.ts.',
            );
        }

        appDelegate.modResults.contents = contents
            .replace('import React\n', 'import React\nimport UIKit\n')
            .replace(EAGER_WINDOW, DEFERRED_WINDOW)
            .replace(
                '  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?',
                `${DEFERRED_START}  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?`,
            )
            .concat(SCENE_DELEGATE);

        return appDelegate;
    });
}

module.exports = { withIosSceneLifecycle };
