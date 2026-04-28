import { WalletGate } from "./components/WalletGate";

export default function App() {
  return (
    <WalletGate>
      <div className="p-4 text-sm text-gray-500">
        Connected. Inbox coming next.
      </div>
    </WalletGate>
  );
}
