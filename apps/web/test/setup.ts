// Preloaded by bun test (see bunfig.toml). Registers a DOM for React Testing
// Library; happy-dom must be registered before Testing Library is imported.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

const { afterEach } = await import("bun:test");
const { cleanup } = await import("@testing-library/react");

// Pin tests to English so assertions stay language-stable.
const { setSettings } = await import("../src/lib/settings");
setSettings({ lang: "en" });

afterEach(() => cleanup());
