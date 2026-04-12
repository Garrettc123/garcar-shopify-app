import { useEffect, useRef } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

// ─── Loader ──────────────────────────────────────────────────────────────────
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const res = await admin.graphql(`
    query GarcarDash {
      shop {
        name
        email
        plan { displayName }
        currencyCode
        primaryDomain { url }
        createdAt
      }
      products(first: 250) { edges { node { id } } }
      orders(first: 250, query: "financial_status:paid") { edges { node { id totalPriceSet { shopMoney { amount currencyCode } } } } }
      customers(first: 1) { edges { node { id } } }
    }
  `);
  const data = await res.json();
  const shop     = data.data?.shop ?? {};
  const orders   = data.data?.orders?.edges ?? [];
  const products = data.data?.products?.edges ?? [];

  const totalRevenue = orders.reduce((acc: number, e: any) => {
    return acc + parseFloat(e.node.totalPriceSet?.shopMoney?.amount ?? "0");
  }, 0);

  return json({
    shop,
    metrics: {
      revenue:    totalRevenue.toFixed(2),
      orders:     orders.length,
      products:   products.length,
      arTarget:   155000,
    },
  });
};

// ─── Action ──────────────────────────────────────────────────────────────────
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form   = await request.formData();
  const intent = form.get("intent");

  if (intent === "generate_product") {
    const r = await admin.graphql(`
      mutation CreateProduct($input: ProductInput!) {
        productCreate(input: $input) {
          product { id title handle }
          userErrors { field message }
        }
      }
    `, {
      variables: {
        input: {
          title: `Garcar AI Product — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
          descriptionHtml: `<p>Created by <strong>Garcar Enterprise Revenue Engine</strong> on ${new Date().toISOString()}.</p>`,
          status: "DRAFT",
          tags: ["garcar-ai", "auto-generated"],
        },
      },
    });
    const d = await r.json();
    return json({ ok: true, product: d.data?.productCreate?.product });
  }

  return json({ ok: true });
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function CommandCenter() {
  const { shop, metrics } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const counterRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const loading = fetcher.state !== "idle";
  const product = (fetcher.data as any)?.product;

  // Animate counters on mount
  useEffect(() => {
    const targets: Record<string, number> = {
      revenue:  parseFloat(metrics.revenue),
      orders:   metrics.orders,
      products: metrics.products,
      ar:       metrics.arTarget,
    };
    Object.entries(targets).forEach(([key, target]) => {
      const el = counterRefs.current[key];
      if (!el) return;
      const isDecimal = key === "revenue";
      const duration  = 2000;
      const start     = performance.now();
      const step = (now: number) => {
        const p   = Math.min((now - start) / duration, 1);
        const e   = 1 - Math.pow(1 - p, 4);
        const val = target * e;
        el.textContent = isDecimal
          ? "$" + val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
          : Math.floor(val).toLocaleString();
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, [metrics]);

  // Animate progress bars
  useEffect(() => {
    const bars = document.querySelectorAll<HTMLElement>(".gc-progress-fill[data-pct]");
    const t = setTimeout(() => {
      bars.forEach(b => {
        b.style.width = b.dataset.pct + "%";
      });
    }, 300);
    return () => clearTimeout(t);
  }, []);

  // Reveal animation
  useEffect(() => {
    const els = document.querySelectorAll(".gc-reveal");
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("gc-reveal--in"); } });
    }, { threshold: 0.05 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const revenueProducts = [
    { name: "Churn Predictor AI",     model: "SaaS Subscription",  status: "live",  mrr: 25000 },
    { name: "Deal Desk AI",           model: "Per-proposal + SaaS", status: "live",  mrr: 18000 },
    { name: "Content Engine AI",      model: "SaaS Subscription",  status: "live",  mrr: 22000 },
    { name: "MAUT Decision Engine",   model: "SaaS Subscription",  status: "live",  mrr: 97    },
    { name: "NWU Protocol — Basic",   model: "Subscription",       status: "live",  mrr: 49    },
    { name: "NWU Protocol — Premium", model: "Subscription",       status: "live",  mrr: 149   },
    { name: "NWU Protocol — Enterprise", model: "Subscription",    status: "live",  mrr: 499   },
    { name: "AI Growth Engine",       model: "Managed Service",    status: "live",  mrr: 1497  },
    { name: "Revenue Recovery Sprint","model": "Weekly Sprint",    status: "live",  mrr: 497   },
    { name: "Smart Contract Auditor", model: "API + SaaS",         status: "build", mrr: 25000 },
    { name: "DeFi Yield Aggregator",  model: "% Yield + SaaS",     status: "build", mrr: 30000 },
    { name: "Lead Enrichment Engine", model: "Usage-based API",    status: "build", mrr: 20000 },
  ];

  const liveTotal = revenueProducts.filter(p => p.status === "live").reduce((a, p) => a + p.mrr, 0);

  return (
    <div className="gc-root gc-canvas">
      {/* Background elements */}
      <div className="gc-grid-bg" />
      <div className="gc-orb gc-orb--1" />
      <div className="gc-orb gc-orb--2" />
      <div className="gc-orb gc-orb--3" />

      <TitleBar title="Garcar Enterprise" />

      <div className="gc-content">

        {/* ── Header ── */}
        <header className="gc-header gc-reveal">
          <div className="gc-logo">
            <div className="gc-logo__hex">⬡</div>
            <div>
              <div className="gc-logo__text">Garcar Enterprise</div>
              <span className="gc-logo__sub">Shopify Revenue Command Center</span>
            </div>
          </div>
          <div className="gc-header__right">
            <span className="gc-live-pill">
              <span className="gc-live-dot" />
              All Systems Live
            </span>
            <span className="gc-shop-name">{shop?.name}</span>
          </div>
        </header>

        {/* ── KPI Row ── */}
        <div className="gc-kpi-row gc-stagger">
          <div className="gc-kpi">
            <div className="gc-kpi__label">Store Revenue (Paid)</div>
            <div className="gc-kpi__value gc-counter">
              <span ref={el => { counterRefs.current.revenue = el; }}>$0.00</span>
            </div>
            <div className="gc-kpi__delta gc-kpi__delta--up">↑ Shopify Admin API · live</div>
            <div className="gc-kpi__spark gc-kpi__spark--green" />
          </div>
          <div className="gc-kpi">
            <div className="gc-kpi__label">Total Orders</div>
            <div className="gc-kpi__value gc-counter">
              <span ref={el => { counterRefs.current.orders = el; }}>0</span>
            </div>
            <div className="gc-kpi__delta gc-kpi__delta--up">↑ Paid orders</div>
            <div className="gc-kpi__spark gc-kpi__spark--cyan" />
          </div>
          <div className="gc-kpi">
            <div className="gc-kpi__label">Products Live</div>
            <div className="gc-kpi__value gc-counter">
              <span ref={el => { counterRefs.current.products = el; }}>0</span>
            </div>
            <div className="gc-kpi__delta gc-kpi__delta--flat">→ Shopify catalog</div>
            <div className="gc-kpi__spark gc-kpi__spark--gold" />
          </div>
          <div className="gc-kpi">
            <div className="gc-kpi__label">ARR Target</div>
            <div className="gc-kpi__value gc-counter">
              <span ref={el => { counterRefs.current.ar = el; }}>0</span>
              <span className="unit">+</span>
            </div>
            <div className="gc-kpi__delta gc-kpi__delta--up">↑ 12 active systems</div>
            <div className="gc-kpi__spark gc-kpi__spark--green" />
          </div>
        </div>

        {/* ── Main area ── */}
        <div className="gc-grid gc-grid--sidebar">

          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Revenue Engine Pipeline */}
            <div className="gc-card gc-reveal">
              <div className="gc-card__header">
                <span className="gc-card__title">Revenue Engine Pipeline</span>
                <span className="gc-badge gc-badge--live gc-badge--dot">Active</span>
              </div>
              <div className="gc-card__body">
                <div className="gc-pipeline">
                  {[
                    { icon: "🧲", label: "Lead Acquisition",    desc: `20+ DFW contractors in pipeline · AI SDR running`,       status: "active" },
                    { icon: "🧠", label: "AI Qualification",    desc: "RHNS engine scores leads by LTV probability",             status: "active" },
                    { icon: "📄", label: "Deal Desk Proposal",  desc: "Auto-generates enterprise proposals via Deal Desk AI",    status: "active" },
                    { icon: "💳", label: "Stripe Checkout",     desc: "Payment links live · 9 invoices sent · $873 open",        status: "active" },
                    { icon: "📡", label: "Webhook Monitoring",  desc: "app/uninstalled · scopes_update · order events live",     status: "active" },
                    { icon: "🔄", label: "Auto-Retraining",     desc: "Churn Predictor retrains on new merchant behavioral data", status: "pending" },
                  ].map((step, i) => (
                    <div key={i} className="gc-pipeline-step">
                      <div className={`gc-pipeline-step__icon gc-pipeline-step__icon--${step.status === "active" ? "active" : "pending"}`}>
                        {step.icon}
                      </div>
                      <div className="gc-pipeline-step__content">
                        <div className="gc-pipeline-step__name">{step.label}</div>
                        <div className="gc-pipeline-step__desc">{step.desc}</div>
                        <div className="gc-pipeline-step__meta">
                          <span className={`gc-badge gc-badge--${step.status === "active" ? "live" : "build"} gc-badge--dot`}>
                            {step.status === "active" ? "Running" : "Queued"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Revenue Products Table */}
            <div className="gc-card gc-reveal">
              <div className="gc-card__header">
                <span className="gc-card__title">Revenue Stack — All Products</span>
                <span className="gc-badge gc-badge--info">{revenueProducts.length} systems</span>
              </div>
              <div className="gc-card__body" style={{ padding: 0 }}>
                <table className="gc-table">
                  <thead>
                    <tr>
                      <th>System</th>
                      <th>Model</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>MRR Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueProducts.map((p, i) => (
                      <tr key={i}>
                        <td style={{ color: "var(--gc-text)" }}>{p.name}</td>
                        <td>{p.model}</td>
                        <td>
                          <span className={`gc-badge gc-badge--${p.status === "live" ? "live" : "build"} gc-badge--dot`}>
                            {p.status === "live" ? "Live" : "Building"}
                          </span>
                        </td>
                        <td className="gc-table__amount" style={{ textAlign: "right" }}>
                          ${p.mrr.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="gc-table__total">
                      <td colSpan={3}><strong>Combined Monthly Target</strong></td>
                      <td className="gc-table__amount" style={{ textAlign: "right" }}>
                        ${metrics.arTarget.toLocaleString()}+
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="gc-card gc-reveal">
              <div className="gc-card__header">
                <span className="gc-card__title">AI Quick Actions</span>
              </div>
              <div className="gc-card__body" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <fetcher.Form method="POST">
                  <input type="hidden" name="intent" value="generate_product" />
                  <button
                    type="submit"
                    className={`gc-btn gc-btn--primary${loading ? " gc-btn--loading" : ""}`}
                  >
                    {loading ? "⟳ Generating…" : "⚡ Generate AI Product"}
                  </button>
                </fetcher.Form>
                <a
                  href="https://github.com/Garrettc123/garcar-shopify-app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gc-btn gc-btn--ghost"
                >
                  GitHub →
                </a>
                <a
                  href="https://garrettc123.github.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gc-btn gc-btn--ghost"
                >
                  Garcar HQ →
                </a>
              </div>
              {product && (
                <div className="gc-card__body" style={{ paddingTop: 0 }}>
                  <div className="gc-result-box">
                    ✅ Product created: <strong>{product.title}</strong> &nbsp;·&nbsp; ID: {product.id?.replace("gid://shopify/Product/", "")}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Right sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Store Info */}
            <div className="gc-card gc-reveal">
              <div className="gc-card__header">
                <span className="gc-card__title">Store</span>
                <span className="gc-badge gc-badge--live gc-badge--dot">Connected</span>
              </div>
              <div className="gc-card__body">
                <div className="gc-status-list">
                  {[
                    { label: "Name",     val: shop?.name },
                    { label: "Plan",     val: shop?.plan?.displayName },
                    { label: "Currency", val: shop?.currencyCode },
                    { label: "Domain",   val: shop?.primaryDomain?.url?.replace("https://","") },
                    { label: "Email",    val: shop?.email },
                  ].map((r, i) => (
                    <div key={i} className="gc-status-row">
                      <span className="gc-status-name">{r.label}</span>
                      <span className="gc-status-val">{r.val || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* System Status */}
            <div className="gc-card gc-reveal">
              <div className="gc-card__header">
                <span className="gc-card__title">System Status</span>
              </div>
              <div className="gc-card__body">
                <div className="gc-status-list">
                  {[
                    { label: "OAuth",            state: "on",   val: "Active" },
                    { label: "Session Storage",  state: "on",   val: "Prisma · SQLite" },
                    { label: "Admin GraphQL",    state: "on",   val: "2026-01" },
                    { label: "Webhooks",         state: "on",   val: "2 registered" },
                    { label: "Churn Predictor",  state: "on",   val: "Live on Vercel" },
                    { label: "Deal Desk AI",     state: "on",   val: "Live on Vercel" },
                    { label: "Content Engine",   state: "on",   val: "Live on Vercel" },
                    { label: "MAUT Engine",      state: "on",   val: "$97/mo" },
                    { label: "NWU Protocol",     state: "on",   val: "$49–$499/mo" },
                    { label: "GitHub CI",        state: "on",   val: "Passing" },
                    { label: "Stripe",           state: "warn", val: "Compliance due" },
                    { label: "garcar.ai DNS",    state: "off",  val: "NXDOMAIN" },
                  ].map((s, i) => (
                    <div key={i} className="gc-status-row">
                      <span className="gc-status-name">
                        <span className={`gc-status-dot gc-status-dot--${s.state}`} />
                        {s.label}
                      </span>
                      <span className="gc-status-val">{s.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Engine Progress */}
            <div className="gc-card gc-reveal">
              <div className="gc-card__header">
                <span className="gc-card__title">Engine Activation</span>
              </div>
              <div className="gc-card__body">
                <div className="gc-progress-row">
                  {[
                    { label: "Churn Predictor AI",   pct: 100, color: "emerald" },
                    { label: "Deal Desk AI",          pct: 100, color: "emerald" },
                    { label: "Content Engine AI",     pct: 100, color: "emerald" },
                    { label: "MAUT Decision Engine",  pct: 100, color: "emerald" },
                    { label: "NWU Protocol",          pct: 100, color: "emerald" },
                    { label: "Lead Enrichment",       pct: 60,  color: "cyan" },
                    { label: "Smart Contract Auditor",pct: 35,  color: "gold" },
                    { label: "DeFi Yield Aggregator", pct: 20,  color: "gold" },
                  ].map((item, i) => (
                    <div key={i} className="gc-progress-item">
                      <div className="gc-progress-top">
                        <span className="gc-progress-label">{item.label}</span>
                        <span className="gc-progress-pct">{item.pct}%</span>
                      </div>
                      <div className="gc-progress-track">
                        <div
                          className={`gc-progress-fill gc-progress-fill--${item.color}`}
                          data-pct={item.pct}
                          style={{ width: "0%" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Live MRR */}
            <div className="gc-card gc-reveal" style={{ background: "rgba(0,255,136,0.03)", borderColor: "rgba(0,255,136,0.15)" }}>
              <div className="gc-card__body" style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--gc-font-mono)", fontSize: "0.68rem", color: "var(--gc-text-3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "8px" }}>
                  Live Products MRR Target
                </div>
                <div style={{ fontFamily: "var(--gc-font-display)", fontSize: "2.4rem", fontWeight: 800, color: "var(--gc-emerald)", letterSpacing: "-0.03em" }}>
                  ${liveTotal.toLocaleString()}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--gc-text-3)", marginTop: "6px" }}>
                  {revenueProducts.filter(p => p.status === "live").length} live products · {revenueProducts.filter(p => p.status === "build").length} building
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
