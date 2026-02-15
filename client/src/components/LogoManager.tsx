import { useState, useRef } from "react";

const API = "/api";

/** Recommended: 128×128 or 256×256 pixels (square) for crisp display at 48px */
const RECOMMENDED_SIZE = "128×128 or 256×256";

interface LogoManagerProps {
  onLogoUploaded?: () => void;
}

const btnPrimary = { padding: "0.5rem 1rem", background: "#2563eb", color: "white", border: "none", borderRadius: 6, cursor: "pointer" as const };
const btnSecondary = { ...btnPrimary, background: "#6b7280" };
const labelStyle = { display: "block" as const, fontSize: "0.75rem", marginBottom: "0.25rem" };

export function LogoManager({ onLogoUploaded }: LogoManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const formData = new FormData();
    formData.append("logo", file);
    fetch(`${API}/settings/logo`, {
      method: "POST",
      body: formData,
    })
      .then((r) => {
        if (!r.ok) return r.json().then((body) => Promise.reject(new Error(body?.error ?? `Upload failed (${r.status})`)));
        return r.json();
      })
      .then(() => {
        onLogoUploaded?.();
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to upload logo");
      })
      .finally(() => {
        setUploading(false);
        e.target.value = "";
      });
  };

  return (
    <div style={{ background: "white", padding: "1.5rem", borderRadius: 8, border: "1px solid #e5e7eb", maxWidth: 400 }}>
      <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 600 }}>Header Logo</h3>
      <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#6b7280" }}>
        Upload a square logo to display in the header (left of "RIO Management"). Best results: {RECOMMENDED_SIZE} pixels. PNG, JPEG, GIF, WebP, or SVG.
      </p>
      {error && <p style={{ color: "#dc2626", fontSize: "0.875rem", margin: "0 0 0.75rem" }}>{error}</p>}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
        onChange={handleUpload}
        style={{ display: "none" }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        style={uploading ? { ...btnSecondary, opacity: 0.7 } : btnPrimary}
      >
        {uploading ? "Uploading…" : "Choose logo"}
      </button>
    </div>
  );
}
