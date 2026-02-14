interface HeaderProps {
  view: "risks" | "settings";
  onViewChange: (view: "risks" | "settings") => void;
}

export function Header({ view, onViewChange }: HeaderProps) {
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
        <div>
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
            RIO Management
          </h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", opacity: 0.85 }}>
            Risk, Issue & Opportunity Management — DoD RIO Guide
          </p>
        </div>
        <nav style={{ display: "flex", gap: "0.5rem" }}>
          <button style={linkStyle(view === "risks")} onClick={() => onViewChange("risks")}>
            Risks
          </button>
          <button style={linkStyle(view === "settings")} onClick={() => onViewChange("settings")}>
            Settings
          </button>
        </nav>
      </div>
    </header>
  );
}
