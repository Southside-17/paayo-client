import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import * as Application from "expo-application";
import { Linking } from "react-native";

import { UpdateGate } from "@/components/update-gate";
import { compare } from "@/lib/updates";

const floor = {
  version: "2.0.0",
  url: "https://play.google.com/store/apps/details?id=com.paayo.ph",
};

function answer(body: unknown, ok = true) {
  globalThis.fetch = jest.fn(async () => ({
    ok,
    json: async () => body,
  })) as never;
}

describe("the version floor", () => {
  it("orders versions segment by segment, padding the short one", () => {
    expect(compare("1.2.0", "1.10.0")).toBe(-1);
    expect(compare("1.2", "1.2.0")).toBe(0);
    expect(compare("2.0.1", "2.0.0")).toBe(1);
  });
});

describe("the update gate", () => {
  afterEach(() => {
    (
      Application as { nativeApplicationVersion: string | null }
    ).nativeApplicationVersion = "9.9.9";
  });

  it("blocks a build below the floor and sends it to the store", async () => {
    (
      Application as { nativeApplicationVersion: string | null }
    ).nativeApplicationVersion = "1.4.0";
    answer(floor);

    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);

    render(<UpdateGate />);

    await waitFor(() =>
      expect(screen.getByText("Update Paayo to carry on")).toBeTruthy(),
    );

    fireEvent.press(screen.getByText("Update"));

    expect(open).toHaveBeenCalledWith(floor.url);
  });

  it("leaves a build at or above the floor alone", async () => {
    answer(floor);

    render(<UpdateGate />);

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

    expect(screen.queryByText("Update Paayo to carry on")).toBeNull();
  });

  it("does not lock anyone out when the update host cannot be reached", async () => {
    (
      Application as { nativeApplicationVersion: string | null }
    ).nativeApplicationVersion = "1.4.0";
    globalThis.fetch = jest.fn(async () => {
      throw new Error("offline");
    }) as never;

    render(<UpdateGate />);

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

    expect(screen.queryByText("Update Paayo to carry on")).toBeNull();
  });
});
