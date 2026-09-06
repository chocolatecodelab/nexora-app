# ============================================================
# Nexora AI — Isolated Sandbox Execution Environment
# ============================================================
# Used by Nexora Agent to safely run untrusted generated code,
# execute npm test, npm run build, and pytest under strict isolation.

FROM node:20-bookworm-slim

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=test

# Install Python 3, pip, git, and testing utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack (for pnpm & yarn) and install test runners
RUN corepack enable && \
    npm install -g jest typescript ts-node && \
    pip3 install --no-cache-dir --break-system-packages pytest pytest-asyncio

# Setup isolated workspace for pre-existing non-root 'node' user (UID 1000)
RUN mkdir -p /workspace && \
    chown -R node:node /workspace

USER node
WORKDIR /workspace

# Default command
CMD ["npm", "test"]
