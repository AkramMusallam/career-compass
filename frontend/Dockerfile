FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM nginx:alpine
RUN sed -i 's/^worker_processes.*/worker_processes auto;/' /etc/nginx/nginx.conf \
  && (grep -q '^user ' /etc/nginx/nginx.conf || sed -i '1i user nginx;' /etc/nginx/nginx.conf) \
  && chown -R nginx:nginx /var/cache/nginx /var/log/nginx
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN chmod -R a+rX /usr/share/nginx/html /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
