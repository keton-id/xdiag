# Multi-stage Dockerfile for xdiag (ERD Creator)

# 1. Build stage
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# 2. Production runtime stage: unprivileged nginx serving static files
FROM nginx:alpine AS runner

# Drop the stock entrypoint: it only rewrites config as root, which we cannot
# do (and do not need) once the image runs as an unprivileged user.
COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/dist /usr/share/nginx/html

RUN chown -R nginx:nginx /usr/share/nginx/html /var/log/nginx \
    && chmod -R a-w /usr/share/nginx/html

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
