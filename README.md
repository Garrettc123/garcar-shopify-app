# Garcar Enterprise — Shopify App

> Embedded Shopify admin app built with **Remix + TypeScript + Polaris + Prisma**. Part of the [Garcar Enterprise](https://garrettc123.github.io) autonomous systems ecosystem.

## Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Remix (React Router v7) |
| **Language** | TypeScript |
| **UI** | Shopify Polaris |
| **Auth** | Shopify App Bridge |
| **Database** | Prisma + SQLite (dev) / PostgreSQL (prod) |
| **API** | Shopify Admin GraphQL API |
| **CLI** | Shopify CLI v4 |

## Scopes

```
write_products, read_products, read_orders, write_orders,
read_customers, write_customers, read_inventory, write_inventory
```

## Quick Start

### Prerequisites
- Node.js ≥ 20.19
- A [Shopify Partner account](https://partners.shopify.com)
- A [development store](https://shopify.dev/docs/apps/tools/development-stores)

### Setup
```bash
# Clone
git clone https://github.com/Garrettc123/garcar-shopify-app.git
cd garcar-shopify-app

# Install
npm install

# Generate Prisma client
npx prisma generate

# Start dev server (connects to Shopify Partner account)
npm run dev
```

On first run, `shopify app dev` will:
1. Prompt you to log into your Shopify Partner account
2. Create the app in the Dev Dashboard (or connect to existing)
3. Create a Cloudflare tunnel for HTTPS
4. Open the app embedded in your dev store admin

### Environment Variables
```env
SHOPIFY_API_KEY=        # From Partner Dashboard
SHOPIFY_API_SECRET=     # From Partner Dashboard
SHOPIFY_APP_URL=        # Auto-set by CLI tunnel
SCOPES=write_products,read_products,read_orders,write_orders,read_customers,write_customers,read_inventory,write_inventory
```

## Project Structure

```
garcar-shopify-app/
├── app/
│   ├── routes/
│   │   ├── app._index.tsx        # Main dashboard
│   │   ├── app.additional.tsx    # Additional page
│   │   ├── app.tsx               # App layout wrapper
│   │   ├── auth.$.tsx            # OAuth handler
│   │   └── webhooks.*.tsx        # Webhook handlers
│   ├── shopify.server.ts         # Shopify auth config
│   ├── db.server.ts              # Prisma client
│   └── root.tsx                  # Root layout
├── extensions/                   # Theme/checkout extensions
├── prisma/
│   └── schema.prisma             # Database schema
├── shopify.app.toml              # App configuration
└── vite.config.ts                # Build config
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with Shopify CLI |
| `npm run build` | Production build |
| `npm run deploy` | Deploy to Shopify |
| `npm run generate` | Generate extensions |
| `npm run lint` | ESLint check |
| `npx prisma studio` | Open Prisma DB browser |

## Deployment

### Deploy to Shopify
```bash
npm run deploy
```

### Docker (Self-hosted)
```bash
docker build -t garcar-shopify-app .
docker run -p 3000:3000 garcar-shopify-app
```

## Part of Garcar Enterprise

This app connects to the broader Garcar Enterprise ecosystem:
- **Churn Predictor AI** — ML churn prediction for Shopify merchants
- **Deal Desk AI** — Auto-generated sales proposals
- **Content Engine AI** — SEO content pipeline
- **NWU Protocol** — Decentralized intelligence layer

## License

MIT — Garcar Enterprise © 2026
