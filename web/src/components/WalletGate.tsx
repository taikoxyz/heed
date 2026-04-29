import type { ReactNode } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { clearKeys } from "../lib/keys";

export function WalletGate({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  function onDisconnect() {
    clearKeys();
    disconnect();
  }

  if (!isConnected) {
    return (
      <div className="p-8">
        <h1 className="text-2xl mb-4">Heed</h1>
        <p className="text-sm text-gray-500 mb-4">
          Connect a wallet to view your inbox.
        </p>
        <div className="flex flex-wrap gap-2">
          {connectors.map((c) => (
            <button
              key={c.uid}
              onClick={() => connect({ connector: c })}
              className="px-4 py-2 border rounded"
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="flex justify-between items-center p-4 border-b">
        <span className="font-mono text-sm">{address}</span>
        <button
          onClick={onDisconnect}
          className="text-sm underline text-gray-600"
        >
          Disconnect
        </button>
      </header>
      {children}
    </div>
  );
}
