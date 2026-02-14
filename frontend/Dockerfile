# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --registry=https://registry.npmmirror.com

COPY . .
RUN npm run build

# --- Production Stage ---
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
# 使用自定义 nginx 配置 (由外部 nginx 反代时，此处仅做静态服务)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
