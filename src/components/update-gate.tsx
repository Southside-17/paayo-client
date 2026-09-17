import { Linking, Modal, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useVersionFloor } from "@/lib/updates";

/**
 * A full-screen block for builds the API will no longer talk to.
 *
 * There is no dismiss affordance on purpose. Below the floor the app cannot do
 * anything useful, and a modal someone can swipe away only moves the failure to
 * a screen where it reads as a bug.
 */
export function UpdateGate() {
  const floor = useVersionFloor();

  if (!floor) {
    return null;
  }

  return (
    <Modal
      visible
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      <View className="bg-background flex-1 items-center justify-center gap-4 px-8">
        <Text className="text-foreground text-center text-lg font-semibold">
          Update Paayo to carry on
        </Text>

        <Text className="text-muted-foreground text-center text-base">
          This version is no longer supported. Install the latest one to keep
          booking and working.
        </Text>

        <Button onPress={() => void Linking.openURL(floor.url)}>Update</Button>
      </View>
    </Modal>
  );
}
