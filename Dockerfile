# Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
# SPDX-License-Identifier: MIT OR Apache-2.0
#
# XIOM Playground runtime image.
# The server executes user-submitted programs, so the container is the
# security boundary: non-root user, read-only root filesystem, tmpfs /tmp,
# no capabilities, no new privileges, memory/pids limits, and an internal
# network with no egress. The compiler toolchain is mounted read-only at
# /toolchain; clang is installed for linking.

FROM ubuntu:24.04

RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      nodejs clang ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin xiomp \
 && mkdir -p /data \
 && chown xiomp:xiomp /data

WORKDIR /app
COPY --chown=xiomp:xiomp . /app

# P1: build the Landlock wrapper that confines every compiler child. The
# build fails here if the helper does not compile, so an image can never
# ship without a working sandbox binary (the server also fails closed in
# require mode when it cannot execute the toolchain through it).
RUN clang -O2 -Wall -Wextra -o /usr/local/bin/xiom-sandbox /app/sandbox/xiom-sandbox.c

USER xiomp
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV XIOM_BIN=/toolchain/bin/xiom
ENV XIOM_STDLIB=/toolchain/lib

EXPOSE 3000
CMD ["node", "server.js"]
