import { useState } from "react";
import { isAddress, type Address } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  Code,
  Group,
  NumberInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMyInbox } from "../hooks/useMyInbox";
import { useHeedActions } from "../hooks/useHeedActions";
import { errorMessage } from "../lib/format";

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

type Task = "key" | "fee" | "trust" | "untrust";

export function Account() {
  const { data: inbox, isLoading } = useMyInbox();
  const actions = useHeedActions();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<Task | null>(null);
  const [fee, setFee] = useState<number | string>("");
  const [trustAddr, setTrustAddr] = useState("");

  const currentKey = inbox?.keys[0];
  const hasKey = !!currentKey && currentKey.pub !== ZERO_BYTES32;
  const currentNonce = hasKey ? Number(currentKey!.keyNonce) : -1;
  const nextNonce = currentNonce + 1;

  async function run(task: Task, fn: () => Promise<unknown>) {
    setBusy(task);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["myInbox"] });
    } catch (e) {
      notifications.show({ color: "red", message: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Stack gap="md" maw={620}>
      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Stack gap={4}>
            <Title order={2}>Encryption key</Title>
            <Text size="sm" c="dimmed">
              Publish an X25519 public key so others can send you encrypted
              mail. It is derived from a wallet signature; the private key never
              leaves this device.
            </Text>
          </Stack>
          <Group gap="xs" align="center">
            <Text size="sm" c="dimmed">
              Status:
            </Text>
            {isLoading ? (
              <Badge variant="light" color="gray">
                loading…
              </Badge>
            ) : hasKey ? (
              <Badge variant="light" color="teal">
                published (nonce {currentNonce})
              </Badge>
            ) : (
              <Badge variant="light" color="red">
                not published
              </Badge>
            )}
          </Group>
          {hasKey && (
            <Code block fz="xs" style={{ wordBreak: "break-all" }}>
              {currentKey!.pub}
            </Code>
          )}
          <Group>
            <Button
              loading={busy === "key"}
              disabled={busy !== null}
              onClick={() =>
                run("key", async () => {
                  await actions.publishKey(nextNonce);
                  notifications.show({
                    color: "teal",
                    message: `Encryption key published (nonce ${nextNonce}).`,
                  });
                })
              }
            >
              {busy === "key"
                ? "Publishing…"
                : hasKey
                  ? "Rotate key"
                  : "Publish key"}
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Stack gap={4}>
            <Title order={2}>Anti-spam fee</Title>
            <Text size="sm" c="dimmed">
              Senders must pay this fee (in gwei) to mail you, unless you trust
              them.
            </Text>
          </Stack>
          <Text size="sm">
            <Text component="span" c="dimmed">
              Current:{" "}
            </Text>
            <Code fz="xs">
              {isLoading ? "…" : `${Number(inbox?.feeGwei ?? 0)} gwei`}
            </Code>
          </Text>
          <NumberInput
            id="account-fee"
            label="New fee (gwei)"
            min={0}
            value={fee}
            onChange={(v) => setFee(v as number | string)}
            placeholder="0"
            allowDecimal={false}
            allowNegative={false}
          />
          <Group>
            <Button
              variant="default"
              loading={busy === "fee"}
              disabled={busy !== null || fee === ""}
              onClick={() =>
                run("fee", async () => {
                  const v = Number(fee);
                  if (!Number.isInteger(v) || v < 0) {
                    throw new Error("fee must be a non-negative whole number");
                  }
                  await actions.setFee(v);
                  notifications.show({
                    color: "teal",
                    message: `Anti-spam fee set to ${v} gwei.`,
                  });
                  setFee("");
                })
              }
            >
              {busy === "fee" ? "Saving…" : "Set fee"}
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Stack gap={4}>
            <Title order={2}>Trusted senders</Title>
            <Text size="sm" c="dimmed">
              Trusted addresses can mail you for free, bypassing your fee.
            </Text>
          </Stack>
          <TextInput
            id="account-trust"
            label="Address"
            value={trustAddr}
            onChange={(e) => setTrustAddr(e.currentTarget.value.trim())}
            placeholder="0x…"
            styles={{
              input: { fontFamily: "var(--mantine-font-family-monospace)" },
            }}
          />
          <Group>
            <Button
              variant="default"
              loading={busy === "trust"}
              disabled={busy !== null || !isAddress(trustAddr)}
              onClick={() =>
                run("trust", async () => {
                  await actions.trust([trustAddr as Address]);
                  notifications.show({
                    color: "teal",
                    message: "Sender trusted.",
                  });
                  setTrustAddr("");
                })
              }
            >
              {busy === "trust" ? "Trusting…" : "Trust"}
            </Button>
            <Button
              variant="subtle"
              loading={busy === "untrust"}
              disabled={busy !== null || !isAddress(trustAddr)}
              onClick={() =>
                run("untrust", async () => {
                  await actions.untrust([trustAddr as Address]);
                  notifications.show({
                    color: "teal",
                    message: "Sender untrusted.",
                  });
                  setTrustAddr("");
                })
              }
            >
              {busy === "untrust" ? "Removing…" : "Untrust"}
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
