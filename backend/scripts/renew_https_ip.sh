#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
docker run --rm -v "$PWD/certbot/etc:/etc/letsencrypt" -v "$PWD/certbot/www:/var/www/certbot" certbot/certbot:v5.4.0 renew --webroot -w /var/www/certbot --quiet
docker compose -f docker-compose.prod.yml -f docker-compose.https.yml exec -T nginx nginx -s reload
