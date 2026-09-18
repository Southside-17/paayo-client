import * as Application from "expo-application";
import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";

/**
 * The update host. It serves the OTA manifest and, from the same baked index,
 * the lowest native version the app may still run at.
 */
export const UPDATES_URL =
  process.env.EXPO_PUBLIC_UPDATES_URL ?? "https://ota.paayo.ph";

/** The floor for one platform, as `GET /minimum` answers it. */
export type Floor = { version: string; url: string };

/**
 * Compare two dotted version strings. Missing segments count as zero, so
 * `1.2` and `1.2.0` are the same version.
 */
export function compare(left: string, right: string): number {
  const a = left.split(".");
  const b = right.split(".");

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (Number(a[i]) || 0) - (Number(b[i]) || 0);

    if (difference !== 0) {
      return difference < 0 ? -1 : 1;
    }
  }

  return 0;
}

async function fetchFloor(): Promise<Floor | null> {
  const response = await fetch(
    `${UPDATES_URL}/minimum?platform=${Platform.OS}`,
  );

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as Floor;
}

/**
 * The store listing to send someone to when their build is below the floor, or
 * null while it is not.
 *
 * A build that cannot reach the update host is left alone: an unanswered
 * request is a network problem, and locking someone out of the app over one
 * would be worse than serving them a version we would rather retire.
 */
export function useVersionFloor(): Floor | null {
  const [floor, setFloor] = useState<Floor | null>(null);

  useEffect(() => {
    let live = true;

    const check = () => {
      void fetchFloor()
        .then((answer) => {
          const installed = Application.nativeApplicationVersion;

          if (!live || !answer || !installed) {
            return;
          }

          setFloor(compare(installed, answer.version) < 0 ? answer : null);
        })
        .catch(() => {
          // Offline. Leave whatever the last answer was standing.
        });
    };

    check();

    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        check();
      }
    });

    return () => {
      live = false;
      listener.remove();
    };
  }, []);

  return floor;
}
