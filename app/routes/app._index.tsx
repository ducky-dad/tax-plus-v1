import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  let settings = await db.taxSettings.findUnique({ where: { shop } });
  if (!settings) {
    settings = await db.taxSettings.create({
      data: { shop, enabled: false, threshold: 10000, kanzeiRate: 3, shohizeiRate: 10, tesuryo: 3, fxRate: 152 },
    });
  }
  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save") {
    await db.taxSettings.upsert({
      where: { shop },
      update: {
        enabled: formData.get("enabled") === "true",
        threshold: parseFloat(formData.get("threshold") as string) || 10000,
        kanzeiRate: parseFloat(formData.get("kanzeiRate") as string) || 3,
        shohizeiRate: parseFloat(formData.get("shohizeiRate") as string) || 10,
        tesuryo: parseFloat(formData.get("tesuryo") as string) || 3,
        updatedAt: new Date(),
      },
      create: {
        shop,
        enabled: formData.get("enabled") === "true",
        threshold: parseFloat(formData.get("threshold") as string) || 10000,
        kanzeiRate: parseFloat(formData.get("kanzeiRate") as string) || 3,
        shohizeiRate: parseFloat(formData.get("shohizeiRate") as string) || 10,
        tesuryo: parseFloat(formData.get("tesuryo") as string) || 3,
        fxRate: 152,
      },
    });
  }

  if (intent === "refreshFx") {
    // Placeholder — will call customs.go.jp API
    await db.taxSettings.update({
      where: { shop },
      data: { fxRate: 152, fxUpdatedAt: new Date(), updatedAt: new Date() },
    });
  }

  return json({ ok: true });
};

export default function Index() {
  const { settings } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const saving = navigation.state === "submitting";

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    submit(data, { method: "post" });
  }

  const example = 130;
  const kanzei = settings.kanzeiRate;
  const shohizei = settings.shohizeiRate;
  const tesuryo = settings.tesuryo;
  const kanzeiAmt = (example * kanzei / 100).toFixed(2);
  const shohizeiAmt = (example * shohizei / 100).toFixed(2);
  const totalAmt = (example + example * kanzei / 100 + example * shohizei / 100 + tesuryo).toFixed(2);

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "0 auto", padding: "2rem 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Import Tax Settings</h1>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>juul-shop.myshopify.com · Shopify Plus · Cart Transform</div>
        </div>
        <span style={{
          fontSize: 12, padding: "3px 10px", borderRadius: 999, fontWeight: 500,
          background: settings.enabled ? "#EAF3DE" : "#FAEEDA",
          color: settings.enabled ? "#3B6D11" : "#854F0B"
        }}>
          {settings.enabled ? "● Active" : "○ Disabled"}
        </span>
      </div>

      <form onSubmit={handleSave}>
        <input type="hidden" name="intent" value="save" />

        {/* Threshold */}
        <div style={cardStyle}>
          <div style={cardLabelStyle}>Threshold & FX Rate</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Cart threshold (USD)</label>
              <input style={inputStyle} type="number" name="threshold" defaultValue={settings.threshold} min={0} step={1} />
              <span style={hintStyle}>Tax applies when subtotal ≥ this amount</span>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>FX rate (¥/USD)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ ...inputStyle, display: "flex", alignItems: "center", background: "#f5f5f5", color: "#333" }}>
                  ¥{settings.fxRate.toFixed(2)}
                </div>
                <button type="button" style={secondaryBtnStyle}
                  onClick={() => submit({ intent: "refreshFx" }, { method: "post" })}>
                  ↻
                </button>
              </div>
              <span style={hintStyle}>customs.go.jp · {new Date(settings.fxUpdatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Tax Rates */}
        <div style={cardStyle}>
          <div style={cardLabelStyle}>Tax Rates</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>関税 (%)</label>
              <input style={inputStyle} type="number" name="kanzeiRate" defaultValue={settings.kanzeiRate} placeholder="3" min={0} max={100} step={0.1} />
              <span style={hintStyle}>Customs duty</span>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>消費税 (%)</label>
              <input style={inputStyle} type="number" name="shohizeiRate" defaultValue={settings.shohizeiRate} placeholder="10" min={0} max={100} step={0.1} />
              <span style={hintStyle}>Consumption tax</span>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>手数料 (USD)</label>
              <input style={inputStyle} type="number" name="tesuryo" defaultValue={settings.tesuryo} placeholder="3.00" min={0} step={0.5} />
              <span style={hintStyle}>Flat handling fee</span>
            </div>
          </div>

          {/* Checkout preview */}
          <div style={{ background: "#f9f9f9", border: "1px solid #eee", borderRadius: 8, marginTop: 16, overflow: "hidden" }}>
            <div style={{ background: "#f0f0f0", padding: "6px 12px", fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Customer checkout preview · $130 cart
            </div>
            {[
              ["Product subtotal", "$130.00"],
              [`関税 (${kanzei}%)`, `$${kanzeiAmt}`],
              [`消費税 (${shohizei}%)`, `$${shohizeiAmt}`],
              ["手数料", `$${tesuryo.toFixed(2)}`],
              ["Order total", `$${totalAmt}`],
            ].map(([label, value], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 12px", borderTop: "1px solid #eee", fontSize: 13, background: i === 4 ? "#f0f0f0" : "transparent" }}>
                <span style={{ color: "#555" }}>{label}</span>
                <span style={{ fontWeight: 500, color: i > 0 && i < 4 ? "#0F6E56" : "#222" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Toggle */}
        <div style={cardStyle}>
          <div style={cardLabelStyle}>Feature Control</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14 }}>Enable tax collection</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Activates Cart Transform — customers will see 3 tax lines at checkout</div>
            </div>
            <label style={{ position: "relative", width: 38, height: 22, flexShrink: 0 }}>
              <input type="checkbox" name="enabled" value="true" defaultChecked={settings.enabled}
                style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{
                position: "absolute", inset: 0, borderRadius: 999, cursor: "pointer",
                background: settings.enabled ? "#1D9E75" : "#ccc",
                transition: "background 0.2s"
              }} />
            </label>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button type="submit" style={primaryBtnStyle} disabled={saving}>
            {saving ? "Saving..." : "💾 Save settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #e5e5e5", borderRadius: 10, padding: "1.25rem", marginBottom: "1rem" };
const cardLabelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 };
const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 5 };
const labelStyle: React.CSSProperties = { fontSize: 13, color: "#555" };
const inputStyle: React.CSSProperties = { height: 36, border: "1px solid #ddd", borderRadius: 6, padding: "0 10px", fontSize: 14, width: "100%", boxSizing: "border-box" };
const hintStyle: React.CSSProperties = { fontSize: 11, color: "#aaa" };
const primaryBtnStyle: React.CSSProperties = { height: 36, padding: "0 20px", borderRadius: 6, fontSize: 13, fontWeight: 500, background: "#185FA5", color: "white", border: "none", cursor: "pointer" };
const secondaryBtnStyle: React.CSSProperties = { height: 36, padding: "0 12px", borderRadius: 6, fontSize: 16, background: "#f5f5f5", border: "1px solid #ddd", cursor: "pointer" };
