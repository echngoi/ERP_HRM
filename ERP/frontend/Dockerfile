# ============================================================
# ERP Frontend — Multi-stage Dockerfile
# Stage 1: Build React (Node 20)
# Stage 2: Serve with Nginx
# ============================================================

# --- Stage 1: Build ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --silent

COPY . .

# Build arg cho API URL — mặc định dùng relative path qua Nginx proxy
ARG VITE_API_BASE_URL=/api
ARG VITE_WS_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

# --- Stage 2: Nginx ---
FROM nginx:alpine

# Xóa config mặc định
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/erp.conf

# Copy frontend build
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
