#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════
#  Garcar Enterprise — Shopify App Bootstrap
#  Usage: bash setup.sh
# ════════════════════════════════════════════════════════════
set -e

REPO="Garrettc123/garcar-shopify-app"
BOLD="\033[1m"; GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; RESET="\033[0m"

print() { echo -e "${BOLD}$1${RESET}"; }
ok()    { echo -e "${GREEN}✅ $1${RESET}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${RESET}"; }
err()   { echo -e "${RED}❌ $1${RESET}"; exit 1; }

print "\n🛒 Garcar Enterprise Shopify App — Bootstrap\n"

# ── 1. Check deps ──
command -v node >/dev/null 2>&1 || err "Node.js is required (>=20)"
command -v npm  >/dev/null 2>&1 || err "npm is required"
command -v gh   >/dev/null 2>&1 || err "GitHub CLI (gh) is required"

# ── 2. Install deps ──
print "Installing dependencies..."
npm install
ok "Dependencies installed"

# ── 3. Generate Prisma client ──
print "Setting up database..."
npx prisma generate
npx prisma migrate deploy 2>/dev/null || npx prisma db push
ok "Database ready"

# ── 4. Collect Shopify credentials ──
print "\n📋 You need two things from partners.shopify.com → Apps → [Your App] → API credentials:\n"
read -p "  SHOPIFY_API_KEY: " SHOPIFY_API_KEY
read -p "  SHOPIFY_API_SECRET: " SHOPIFY_API_SECRET
read -p "  SHOPIFY_APP_URL (Railway URL, e.g. https://garcar.railway.app): " SHOPIFY_APP_URL
read -p "  SHOPIFY_CLI_PARTNERS_TOKEN (from Settings → Partner API clients): " SHOPIFY_CLI_PARTNERS_TOKEN

# ── 5. Write .env ──
cat > .env << ENV
SHOPIFY_API_KEY=${SHOPIFY_API_KEY}
SHOPIFY_API_SECRET=${SHOPIFY_API_SECRET}
SHOPIFY_APP_URL=${SHOPIFY_APP_URL}
SCOPES=write_products,read_products,read_orders,write_orders,read_customers,write_customers,read_inventory,write_inventory
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./prisma/dev.sqlite
SHOPIFY_CLI_PARTNERS_TOKEN=${SHOPIFY_CLI_PARTNERS_TOKEN}
ENV
ok ".env written"

# ── 6. Push GitHub secrets ──
print "Pushing secrets to GitHub Actions..."
gh secret set SHOPIFY_API_KEY       --repo "$REPO" --body "$SHOPIFY_API_KEY"
gh secret set SHOPIFY_API_SECRET    --repo "$REPO" --body "$SHOPIFY_API_SECRET"
gh secret set SHOPIFY_APP_URL       --repo "$REPO" --body "$SHOPIFY_APP_URL"
gh secret set SHOPIFY_CLI_PARTNERS_TOKEN --repo "$REPO" --body "$SHOPIFY_CLI_PARTNERS_TOKEN"
gh secret set SCOPES                --repo "$REPO" --body "write_products,read_products,read_orders,write_orders,read_customers,write_customers,read_inventory,write_inventory"
ok "GitHub secrets set"

# ── 7. Dev server prompt ──
print "\n✅ Setup complete!\n"
echo "Next steps:"
echo "  1. Run: npm run dev     ← starts local dev server + Shopify tunnel"
echo "  2. At the prompt, select your dev store"
echo "  3. Shopify CLI will create the app in your Partner Dashboard automatically"
echo "  4. Once the client_id appears, run this script again to push it to GitHub"
echo ""
warn "Railway deploy requires RAILWAY_TOKEN and DATABASE_URL — add those in Railway dashboard"
