FROM ubuntu:22.04

ENV BUN_INSTALL=/root/.bun
ENV PATH=/root/.bun/bin:${PATH}

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl unzip && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash

WORKDIR /work/node-whisper-cpp

COPY tools/ci.ts tools/ci.ts
RUN bun run ./tools/ci.ts install
