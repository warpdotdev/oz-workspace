#!/usr/bin/env bash
# Quick setup script for Oz Workspace development
set -euo pipefail

echo "=== Oz Workspace Setup ==="

# 1. Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# 2. Create .env.local from template if it doesn't exist
if [ ! -f .env.local ]; then
  echo ""
  echo "Creating .env.local from .env.example..."
  cp .env.example .env.local

  # Auto-generate secrets
  AUTH_SECRET=$(openssl rand -base64 32)
  AGENT_API_KEY=$(openssl rand -base64 32)

  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|^AUTH_SECRET=.*|AUTH_SECRET=${AUTH_SECRET}|" .env.local
    sed -i '' "s|^AGENT_API_KEY=.*|AGENT_API_KEY=${AGENT_API_KEY}|" .env.local
  else
    sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=${AUTH_SECRET}|" .env.local
    sed -i "s|^AGENT_API_KEY=.*|AGENT_API_KEY=${AGENT_API_KEY}|" .env.local
  fi

  echo "  Generated AUTH_SECRET and AGENT_API_KEY"
  echo ""
  echo "  ⚠  You still need to set these in .env.local:"
  echo "     - WARP_API_KEY (get from https://app.warp.dev/settings/api-keys)"
  echo "     - WARP_ENVIRONMENT_ID (get from the Warp dashboard or CLI)"
  echo "     - AGENT_CALLBACK_URL (use ngrok for local dev: ngrok http 3000)"
else
  echo ""
  echo ".env.local already exists, skipping."
fi

# 3. Generate Prisma client and set up database
echo ""
echo "Setting up database..."
npx prisma generate
npx prisma db push

echo ""
echo "=== Setup complete! ==="
echo "Run 'npm run dev' to start the development server."
