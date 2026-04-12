#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Garcar · Stripe Webhook Local Test Script
# Usage: bash scripts/stripe-test.sh [event_type]
#
# Prerequisites:
#   1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
#   2. Run `stripe login` once to authenticate
#   3. Start your Remix dev server: npm run dev
#   4. Run this script in a separate terminal
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

LOCAL_PORT="${VITE_PORT:-3000}"
WEBHOOK_PATH="/webhooks/stripe"
BASE_URL="http://localhost:${LOCAL_PORT}"

# ── Colors ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Garcar · Stripe Webhook Test Runner${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ── Check Stripe CLI is installed ────────────────────────────────────────────
if ! command -v stripe &> /dev/null; then
  echo -e "${RED}✗ Stripe CLI not found.${NC}"
  echo "  Install it: https://stripe.com/docs/stripe-cli"
  exit 1
fi

echo -e "${GREEN}✓ Stripe CLI found:${NC} $(stripe --version)"

# ── Check dev server is running ──────────────────────────────────────────────
if ! curl -sf "${BASE_URL}/health" > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠  Dev server not responding at ${BASE_URL}/health${NC}"
  echo "   Start it with: npm run dev"
  echo "   Then re-run this script."
  exit 1
fi
echo -e "${GREEN}✓ Dev server healthy at ${BASE_URL}${NC}"

# ── Determine which event to fire ────────────────────────────────────────────
EVENT="${1:-all}"

fire_event() {
  local event="$1"
  echo -e "\n${CYAN}→ Firing:${NC} ${event}"
  stripe trigger "${event}" \
    --forward-to "${BASE_URL}${WEBHOOK_PATH}" \
    2>&1 | tail -5
}

case "${EVENT}" in
  checkout)
    fire_event "checkout.session.completed"
    ;;
  invoice.paid)
    fire_event "invoice.payment_succeeded"
    ;;
  invoice.failed)
    fire_event "invoice.payment_failed"
    ;;
  sub.created)
    fire_event "customer.subscription.created"
    ;;
  sub.updated)
    fire_event "customer.subscription.updated"
    ;;
  sub.deleted)
    fire_event "customer.subscription.deleted"
    ;;
  refund)
    fire_event "charge.refunded"
    ;;
  all)
    echo -e "${YELLOW}Firing all 7 webhook events...${NC}"
    fire_event "checkout.session.completed"
    fire_event "invoice.payment_succeeded"
    fire_event "invoice.payment_failed"
    fire_event "customer.subscription.created"
    fire_event "customer.subscription.updated"
    fire_event "customer.subscription.deleted"
    fire_event "charge.refunded"
    ;;
  listen)
    echo -e "\n${CYAN}Starting live webhook forward (Ctrl+C to stop)...${NC}"
    stripe listen \
      --forward-to "${BASE_URL}${WEBHOOK_PATH}" \
      --events checkout.session.completed,invoice.payment_succeeded,invoice.payment_failed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,charge.refunded
    ;;
  *)
    echo -e "${YELLOW}Unknown event: ${EVENT}${NC}"
    echo ""
    echo "Usage: bash scripts/stripe-test.sh [event]"
    echo ""
    echo "Events:"
    echo "  all            Fire all 7 events (default)"
    echo "  checkout       checkout.session.completed"
    echo "  invoice.paid   invoice.payment_succeeded"
    echo "  invoice.failed invoice.payment_failed"
    echo "  sub.created    customer.subscription.created"
    echo "  sub.updated    customer.subscription.updated"
    echo "  sub.deleted    customer.subscription.deleted"
    echo "  refund         charge.refunded"
    echo "  listen         Live forward mode (continuous)"
    exit 1
    ;;
esac

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Done. Check your app logs for RevenueEvent inserts.${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
