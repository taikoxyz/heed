import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { WalletProviders } from "./components/WalletProviders";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <WalletProviders>
          <App />
        </WalletProviders>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
