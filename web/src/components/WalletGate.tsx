import type { ReactNode } from "react";
import { useAccount, useConnect } from "wagmi";
import { Button, Center, Paper, Stack, Text, Title } from "@mantine/core";
import { HeedWordmark } from "./HeedWordmark";

export function WalletGate({ children }: { children: ReactNode }) {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  if (!isConnected) {
    return (
      <Center mih="100vh" p="md">
        <Paper withBorder p="xl" radius="md" w="100%" maw={420} shadow="sm">
          <Stack gap="lg">
            <Title order={1} m={0}>
              <HeedWordmark height={36} />
            </Title>
            <Text c="dimmed">Connect a wallet to view your inbox.</Text>
            <Stack gap="xs">
              {connectors.map((c) => (
                <Button
                  key={c.uid}
                  variant="default"
                  size="md"
                  fullWidth
                  onClick={() => connect({ connector: c })}
                >
                  {c.name}
                </Button>
              ))}
            </Stack>
          </Stack>
        </Paper>
      </Center>
    );
  }

  return <>{children}</>;
}
