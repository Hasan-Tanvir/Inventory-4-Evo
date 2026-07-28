import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { initializeApiStorage } from "./services/api";
import { api } from "./services/api";

const bootstrap = async () => {
  try {
    // Try to hydrate from Supabase, but don't block the app if it fails
    await initializeApiStorage().catch(err => console.error("Hydration failed:", err));
  } catch (err) {
    console.error("Bootstrap error:", err);
  } finally {
    createRoot(document.getElementById("root")!).render(<App />);
  }
};

void bootstrap();
