#!/bin/bash
set -e

cd /home/site/wwwroot
export HOSTNAME=0.0.0.0
export PORT="${PORT:-8080}"
exec node server.js
