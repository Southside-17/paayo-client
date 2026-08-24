import { Redirect, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "@/components/back-button";
import { WhereCard } from "@/components/booking-facts";
import { FormMessage } from "@/components/form-message";
import { MediaThumb } from "@/components/media-thumb";
import { MediaViewer, type Viewable } from "@/components/media-viewer";
import { PriceSheet, type PricedLine } from "@/components/price-sheet";
import { QuotationCard } from "@/components/quotation-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding";
import { Label } from "@/components/ui/label";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { Text } from "@/components/ui/text";
import { useSession } from "@/lib/session";
import type { Enquiry } from "@/lib/types";
import { useSubmit } from "@/lib/use-submit";
import { useWorkspace } from "@/lib/workspace";

/**
 * One price asked of this business, and the answer to it.
 *
 * The client has committed to nothing, so neither has the business: the answer
 * is a price or a refusal, and the address stays at the barangay either way.
 */
export default function ProviderEnquiry() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const session = useSession();
  const { staff } = useWorkspace();
  const { busy, message, errorFor, submit } = useSubmit();
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pricing, setPricing] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const [note, setNote] = useState("");
  const [viewing, setViewing] = useState<Viewable | null>(null);

  const mayAnswer = staff?.permissions.includes("booking:answer") ?? false;
  const provider = staff?.provider.id;

  const authenticatedRequest =
    session.status === "authenticated" ? session.authenticatedRequest : null;

  useFocusEffect(
    useCallback(() => {
      if (!authenticatedRequest || !provider) {
        return;
      }

      void authenticatedRequest<{ data: Enquiry }>(
        `/providers/${provider}/enquiries/${id}`,
      )
        .then(({ data }) => setEnquiry(data))
        .catch(() => setFailure("Could not reach Paayo. Try again."));
    }, [authenticatedRequest, provider, id]),
  );

  const price = (lines: PricedLine[], why: string | null) =>
    submit(async () => {
      if (session.status !== "authenticated" || !provider) {
        return;
      }

      await session.authenticatedRequest(
        `/providers/${provider}/enquiries/${id}/quotation`,
        { method: "POST", body: { lines, note: why } },
      );

      const { data } = await session.authenticatedRequest<{ data: Enquiry }>(
        `/providers/${provider}/enquiries/${id}`,
      );

      setEnquiry(data);
      setPricing(false);
    });

  const refuse = () =>
    submit(async () => {
      if (session.status !== "authenticated" || !provider) {
        return;
      }

      const { data } = await session.authenticatedRequest<{ data: Enquiry }>(
        `/providers/${provider}/enquiries/${id}/refusal`,
        { method: "POST", body: { note: note.trim() || null } },
      );

      setEnquiry(data);
      setRefusing(false);
    });

  const withdraw = () =>
    submit(async () => {
      if (session.status !== "authenticated" || !provider) {
        return;
      }

      await session.authenticatedRequest(
        `/providers/${provider}/enquiries/${id}/quotation`,
        { method: "DELETE" },
      );

      const { data } = await session.authenticatedRequest<{ data: Enquiry }>(
        `/providers/${provider}/enquiries/${id}`,
      );

      setEnquiry(data);
    });

  // This screen sits on the app stack rather than in the business tab group,
  // so it holds the gate that group's layout would otherwise hold for it.
  if (!staff) {
    return <Redirect href="/" />;
  }

  const answerable = enquiry?.status.is_awaiting_answer ?? false;
  const standing = enquiry?.quotation ?? null;

  return (
    <SafeAreaView className="bg-background flex-1">
      <KeyboardAvoiding className="flex-1">
        <ScrollView
          contentContainerClassName="gap-4 p-6"
          keyboardShouldPersistTaps="handled"
        >
          <BackButton label="Enquiries" />
          <ScreenHeader
            eyebrow="Enquiry"
            title={name ?? enquiry?.service.name ?? "Enquiry"}
          />

          <FormMessage
            message={message ?? failure ?? errorFor("status") ?? null}
          />

          {enquiry === null && failure === null ? (
            <>
              <Card className="gap-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-full" />
              </Card>
              <Card className="gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-3/4" />
              </Card>
            </>
          ) : null}

          {enquiry ? (
            <>
              <StatusPill tone={enquiry.status.tone}>
                {enquiry.status.wording}
              </StatusPill>

              <Card className="gap-2">
                <Label>What they want priced</Label>
                <Text className="text-sm">{enquiry.description}</Text>
              </Card>

              {enquiry.attachments?.length ? (
                <Card className="gap-2">
                  <Label>What they sent</Label>
                  <View className="flex-row flex-wrap gap-2">
                    {enquiry.attachments.map((attachment) => {
                      const video = attachment.mime.startsWith("video/");
                      const uri = attachment.url;

                      if (!uri) {
                        return null;
                      }

                      return (
                        <Pressable
                          key={attachment.id}
                          accessibilityRole="button"
                          accessibilityLabel={
                            video ? "Play video" : "View photo"
                          }
                          onPress={() => setViewing({ uri, video })}
                        >
                          <MediaThumb uri={uri} video={video} />
                        </Pressable>
                      );
                    })}
                  </View>
                </Card>
              ) : null}

              {enquiry.intake.length > 0 ? (
                <Card className="gap-3">
                  <Label>What they answered</Label>
                  {enquiry.intake.map((answer) => (
                    <View key={answer.question} className="gap-1">
                      <Text className="text-muted-foreground text-xs">
                        {answer.question}
                      </Text>
                      <Text className="text-sm">
                        {answer.answer ?? "Not answered"}
                      </Text>
                    </View>
                  ))}
                </Card>
              ) : null}

              <WhereCard
                place={{
                  label: enquiry.address.label,
                  line: enquiry.address.line,
                  landmark: enquiry.address.landmark,
                  latitude: enquiry.latitude,
                  longitude: enquiry.longitude,
                }}
                radius={enquiry.pin_radius}
              />

              {standing ? <QuotationCard quotation={standing} /> : null}

              {!mayAnswer ? (
                <Card className="gap-2">
                  <Text className="font-semibold">
                    Only an owner or manager can answer this
                  </Text>
                  <Text className="text-muted-foreground text-sm">
                    You can read what was asked, but putting a price on it is
                    somebody else&apos;s call.
                  </Text>
                </Card>
              ) : null}

              {mayAnswer && standing?.status.is_awaiting_answer ? (
                <View className="gap-2">
                  <Button variant="brand" onPress={() => setPricing(true)}>
                    Send a different price
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onPress={() => void withdraw()}
                  >
                    Pull this price back
                  </Button>
                </View>
              ) : null}

              {mayAnswer && answerable ? (
                <View className="gap-2">
                  <Button variant="brand" onPress={() => setPricing(true)}>
                    Send a price
                  </Button>

                  <Card className="gap-2">
                    <Label>Turning it down instead?</Label>
                    <Input
                      value={note}
                      onChangeText={setNote}
                      placeholder="Outside what we do."
                      editable={!busy}
                      accessibilityLabel="Why you are turning it down"
                    />
                    <Text className="text-muted-foreground text-sm">
                      Optional, and held for whoever reviews this. The client is
                      not shown it.
                    </Text>
                    <Button variant="ghost" onPress={() => setRefusing(true)}>
                      Turn it down
                    </Button>
                  </Card>
                </View>
              ) : null}
            </>
          ) : null}

          <PriceSheet
            open={pricing}
            title={standing ? "Send a different price" : "Send a price"}
            revising={standing !== null}
            busy={busy}
            errorFor={errorFor}
            onSend={(lines, why) => void price(lines, why)}
            onDismiss={() => setPricing(false)}
          />

          <ConfirmDialog
            open={refusing}
            title="Turn this enquiry down?"
            body="They will be told you are not quoting it, and will ask somebody else. This cannot be taken back."
            confirm="Turn it down"
            dismiss="Keep it"
            destructive
            busy={busy}
            onConfirm={() => void refuse()}
            onDismiss={() => setRefusing(false)}
          />

          <MediaViewer item={viewing} onClose={() => setViewing(null)} />
        </ScrollView>
      </KeyboardAvoiding>
    </SafeAreaView>
  );
}
