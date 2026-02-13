#!/usr/bin/env bash
# Quick setup script for Oz Workspace development
set -euo pipefail

# Helper to set a value in .env.local (handles macOS/Linux sed differences)
set_env_var() {
  local key="$1" value="$2"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" .env.local
  else
    sed -i "s|^${key}=.*|${key}=${value}|" .env.local
  fi
}

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
  set_env_var "AUTH_SECRET" "$AUTH_SECRET"
  set_env_var "AGENT_API_KEY" "$AGENT_API_KEY"
  echo "  Generated AUTH_SECRET and AGENT_API_KEY"

  # --- Warp API Key ---
  echo ""
  echo "--- Warp API Key ---"
  echo "An API key is required to run Oz agents."
  echo "Generate one in the Warp app under Settings > Platform."
  echo ""
  read -rp "Paste your Warp API key (or press Enter to skip): " WARP_API_KEY_INPUT
  if [ -n "$WARP_API_KEY_INPUT" ]; then
    set_env_var "WARP_API_KEY" "$WARP_API_KEY_INPUT"
    echo "  Set WARP_API_KEY in .env.local"
  else
    echo "  Skipped — set WARP_API_KEY in .env.local later."
  fi

  # --- Warp Environment ID ---
  echo ""
  echo "--- Warp Environment ID ---"
  echo "An environment defines the sandbox your agents run in."
  if command -v oz-dev &>/dev/null; then
    echo ""
    echo "Fetching your environments via oz-dev..."
    echo ""
    # Show a numbered list of environments
    ENV_JSON=$(oz-dev environment list --output-format json 2>/dev/null || echo "[]")
    ENV_COUNT=$(echo "$ENV_JSON" | jq 'length')
    if [ "$ENV_COUNT" -gt 0 ]; then
      echo "$ENV_JSON" | jq -r 'to_entries[] | "  \(.key + 1)) \(.value.name) (\(.value.id))"'
      echo ""
      read -rp "Enter a number to select an environment (or press Enter to skip): " ENV_CHOICE
      if [ -n "$ENV_CHOICE" ] && [ "$ENV_CHOICE" -ge 1 ] 2>/dev/null && [ "$ENV_CHOICE" -le "$ENV_COUNT" ] 2>/dev/null; then
        SELECTED_ENV=$(echo "$ENV_JSON" | jq -r ".[$(( ENV_CHOICE - 1 ))].id")
        set_env_var "WARP_ENVIRONMENT_ID" "$SELECTED_ENV"
        echo "  Set WARP_ENVIRONMENT_ID=$SELECTED_ENV"
      else
        echo "  Skipped — set WARP_ENVIRONMENT_ID in .env.local later."
      fi
    else
      echo "  No environments found. Create one at https://app.warp.dev or via oz-dev."
      read -rp "Enter an environment ID manually (or press Enter to skip): " ENV_ID_INPUT
      if [ -n "$ENV_ID_INPUT" ]; then
        set_env_var "WARP_ENVIRONMENT_ID" "$ENV_ID_INPUT"
        echo "  Set WARP_ENVIRONMENT_ID=$ENV_ID_INPUT"
      else
        echo "  Skipped — set WARP_ENVIRONMENT_ID in .env.local later."
      fi
    fi
  else
    echo "  (oz-dev CLI not found — install it to list environments automatically)"
    read -rp "Enter your environment ID (or press Enter to skip): " ENV_ID_INPUT
    if [ -n "$ENV_ID_INPUT" ]; then
      set_env_var "WARP_ENVIRONMENT_ID" "$ENV_ID_INPUT"
      echo "  Set WARP_ENVIRONMENT_ID=$ENV_ID_INPUT"
    else
      echo "  Skipped — set WARP_ENVIRONMENT_ID in .env.local later."
    fi
  fi

  # --- Agent Callback URL ---
  echo ""
  echo "--- Agent Callback URL ---"
  echo "Agents run in the cloud and need a public URL to send responses back."
  echo "For local dev, use ngrok:  ngrok http 3000"
  read -rp "Enter your callback URL (or press Enter to skip): " CALLBACK_URL_INPUT
  if [ -n "$CALLBACK_URL_INPUT" ]; then
    set_env_var "AGENT_CALLBACK_URL" "$CALLBACK_URL_INPUT"
    echo "  Set AGENT_CALLBACK_URL=$CALLBACK_URL_INPUT"
  else
    echo "  Skipped — set AGENT_CALLBACK_URL in .env.local later."
  fi
else
  echo ""
  echo ".env.local already exists, skipping env setup."
fi

# 3. Generate Prisma client and set up database
echo ""
echo "Setting up database..."
npx prisma generate
npx prisma db push

echo ""
echo "=== Setup complete! ==="

# Show reminder for any values still missing
MISSING=()
grep -q '^WARP_API_KEY=$' .env.local 2>/dev/null && MISSING+=("WARP_API_KEY")
grep -q '^WARP_ENVIRONMENT_ID=$' .env.local 2>/dev/null && MISSING+=("WARP_ENVIRONMENT_ID")
grep -q '^AGENT_CALLBACK_URL=$' .env.local 2>/dev/null && MISSING+=("AGENT_CALLBACK_URL")

if [ ${#MISSING[@]} -gt 0 ]; then
  echo ""
  echo "⚠  Still need to set in .env.local:"
  for var in "${MISSING[@]}"; do
    echo "   - $var"
  done
fi

echo ""
echo "Run 'npm run dev' to start the development server."
