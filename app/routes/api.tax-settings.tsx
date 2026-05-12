import type { LoaderFunctionArgs } from "react-router";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (!shop) {
    return new Response(JSON.stringify({ error: "missing shop" }), { status: 400, headers });
  }

  try {
    const s = await db.taxSettings.findUnique({ where: { shop } });
    if (!s) {
      return new Response(JSON.stringify({
        enabled: false,
        threshold: 10000,
        kanzeiRate: 0,
        shohizeiRate: 10,
        tesuryo: 0,
      }), { status: 200, headers });
    }
    return new Response(JSON.stringify({
      enabled: s.enabled,
      threshold: Number(s.threshold),
      kanzeiRate: Number(s.kanzeiRate),
      shohizeiRate: Number(s.shohizeiRate),
      tesuryo: Number(s.tesuryo),
    }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: "db error" }), { status: 500, headers });
  }
}
