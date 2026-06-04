import { useAccount, useSwitchChain } from "wagmi";
import { Alert, Button, Group } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { DEFAULT_CHAIN_ID, NETWORKS, SUPPORTED_CHAIN_IDS } from "../lib/config";

export function NetworkGuard() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (
    !isConnected ||
    (chainId !== undefined && SUPPORTED_CHAIN_IDS.includes(chainId))
  )
    return null;

  const fallback = NETWORKS[DEFAULT_CHAIN_ID]!;

  return (
    <Alert
      color="red"
      variant="light"
      icon={<IconAlertTriangle />}
      title="Unsupported network"
      mb="md"
    >
      <Group gap="sm" wrap="wrap" align="center">
        <span>
          Heed runs on Taiko and Ethereum. Switch your wallet to a supported
          network to continue.
        </span>
        <Button
          size="xs"
          variant="default"
          disabled={isPending}
          onClick={() => switchChain({ chainId: fallback.chainId })}
        >
          {isPending ? "Switching…" : `Switch to ${fallback.label}`}
        </Button>
      </Group>
    </Alert>
  );
}
