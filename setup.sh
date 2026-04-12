#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Garcar Shopify App · One-Command Bootstrap
# Usage: bash setup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

header() { echo -e "\n${CYAN}── $1 ──────────────────────────────────────────${NC}"; }
ok()     { echo -e "${GREEN}✓ $1${NC}"; }
warn()   { echo -e "${YELLOW}⚠  $1${NC}"; }
fail()   { echo -e "${RED}✗ $1${NC}"; exit 1; }

echo -e "${CYAN}"
echo "  ██████╗  █████╗ ██████╗  ██████╗ █████╗ ██████╗ "
echo " ██╔════╝ ██╔══██╗██╔══██╗██╔════╝██╔══██╗██╔══██╗"
echo " ██║  ███╗███████║██████╔╝██║     ███████║██████╔╝"
echo " ██║   ██║██╔══██║██╔══██╗██║     ██╔══██║██╔══██╗"
echo " ╚██████╔╝██║  ██║██║  ██║╚██████╗██║  ██║██║  ██║"
echo "  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝"
echo -e "${NC}"
echo "  Shopify App · Bootstrap Script"
echo "  ────────────────────────────────────────────────────"

# ── 1. Node version check ────────────────────────────────────────────────────
header "Node.js"
NODE_VER=$(node --version 2>/dev/null || echo "none")
if [[ "$NODE_VER" == "none" ]]; then
  fail "Node.js not found. Install v20+: https://nodejs.org"
fi
ok "Node $NODE_VER"

# ── 2. Install dependencies ──────────────────────────────────────────────────
header "Dependencies"
npm install --legacy-peer-deps
ok "npm install complete"

# ── 3. .env setup ────────────────────────────────────────────────────────────
header ".env"
if [ ! -f .env ]; then
  cp .env.example .env
  warn ".env created from .env.example — fill in your credentials"
else
  ok ".env already exists"
fi

# ── 4. Prisma ────────────────────────────────────────────────────────────────
header "Prisma"
npx prisma generate
ok "Prisma client generated"
npx prisma db push
ok "Database schema pushed"

# ── 5. GitHub Secrets (optional — requires gh CLI + GITHUB_REPO set) ─────────
header "GitHub Secrets"
if ! command -v gh &> /dev/null; then
  warn "gh CLI not found — skipping GitHub secrets push"
  warn "Install: https://cli.github.com"
else
  REPO="${GITHUB_REPO:-Garrettc123/garcar-shopify-app}"
  echo "Pushing secrets to github.com/${REPO} ..."

  push_secret() {
    local name="$1"
    local value="${!name:-}"
    if [ -n "$value" ]; then
      echo "$value" | gh secret set "$name" -R "$REPO" --body -
      ok "Secret set: $name"
    else
      warn "Skipping $name (not set in environment)"
    fi
  }

  # Source .env to pick up values
  set -a; source .env 2>/dev/null || true; set +a

  push_secret "SHOPIFY_API_KEY"
  push_secret "SHOPIFY_API_SECRET"
  push_secret "SHOPIFY_APP_URL"
  push_secret "SHOPIFY_CLI_PARTNERS_TOKEN"
  push_secret "DATABASE_URL"
  push_secret "RAILWAY_TOKEN"
  push_secret "SLACK_WEBHOOK_URL"
  push_secret "STRIPE_SECRET_KEY"
  push_secret "STRIPE_WEBHOOK_SECRET"
fi

# ── 6. Done ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Bootstrap complete.${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Next steps:"
echo "  1. Fill in .env with your Shopify + Stripe credentials"
echo "  2. Register Stripe webhook at dashboard.stripe.com/webhooks"
echo "     → Endpoint: \$SHOPIFY_APP_URL/webhooks/stripe"
echo "     → Events: checkout.session.completed, invoice.payment_succeeded,"
echo "               invoice.payment_failed, customer.subscription.created,"
echo "               customer.subscription.updated, customer.subscription.deleted,"
echo "               charge.refunded"
echo "  3. Copy whsec_... into .env as STRIPE_WEBHOOK_SECRET"
echo "  4. Start dev server: npm run dev"
echo "  5. Test webhooks:    bash scripts/stripe-test.sh"
echo ""
