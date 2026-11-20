# syntax=docker/dockerfile:1
#
# Production image for ChainBeat: build with Node, serve the static files with unprivileged nginx on :8080.
# NOT built or run in the environment this project was developed in — treat as a starting point and test it.
#
#   docker build -t chainbeat .
#   docker run --rm -p 8080:8080 chainbeat        # http://localhost:8080
#
# Hosting under a sub-path:  docker build --build-arg VITE_BASE_PATH=/chainbeat/ -t chainbeat .
#                            (also adjust the `try_files` fallback in nginx.conf to /chainbeat/index.html)

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# --include=dev: the build needs TypeScript, Vite and Tailwind even if NODE_ENV=production is set in the image.
RUN npm ci --include=dev
COPY . .
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO /dev/null http://127.0.0.1:8080/ || exit 1
