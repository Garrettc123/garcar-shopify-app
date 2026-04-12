import { json } from "@remix-run/node";

export async function loader() {
  return json(
    {
      status: "ok",
      app: "garcar-shopify-app",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
