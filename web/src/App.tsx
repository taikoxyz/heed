import { WalletGate } from "./components/WalletGate";
import { InboxList } from "./components/InboxList";

export default function App() {
  return (
    <WalletGate>
      <InboxList />
    </WalletGate>
  );
}
