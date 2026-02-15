const API = "/api";

interface HeaderProps {
  view: "risks" | "help" | "settings";
  onViewChange: (view: "risks" | "help" | "settings") => void;
  /** Cache-bust key: increment after logo upload to refresh */
  logoKey?: number;
}

const LOGO_SIZE_PX = 48; // Display size; recommend 128×128 or 256×256 for upload

export function Header({ view, onViewChange, logoKey = 0 }: HeaderProps) {
  const linkStyle = (active: boolean) => ({
    padding: "0.5rem 1rem",
    background: active ? "rgba(255,255,255,0.15)" : "transparent",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: active ? 600 : 400,
  });

  return (
    <header
      style={{
        background: "#1e293b",
        color: "white",
        padding: "1rem 1.5rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div
            style={{
              width: LOGO_SIZE_PX,
              height: LOGO_SIZE_PX,
              minWidth: LOGO_SIZE_PX,
              minHeight: LOGO_SIZE_PX,
              borderRadius: 6,
              background: "rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
            title="Logo"
          >
            <img
              src={`${API}/settings/logo${logoKey ? `?v=${logoKey}` : ""}`}
              alt="Logo"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div>
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
            RIO Management
          </h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", opacity: 0.85 }}>
            Risk, Issue & Opportunity Management — DoD RIO Guide
          </p>
          </div>
        </div>
        <nav style={{ display: "flex", gap: "0.5rem" }}>
          <button style={linkStyle(view === "risks")} onClick={() => onViewChange("risks")}>
            Risks, Issues, and Opportunities
          </button>
          <button style={linkStyle(view === "help")} onClick={() => onViewChange("help")}>
            Help
          </button>
          <button style={linkStyle(view === "settings")} onClick={() => onViewChange("settings")}>
            Settings
          </button>
        </nav>
      </div>
    </header>
  );
}
