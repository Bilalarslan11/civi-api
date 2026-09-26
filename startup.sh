#!/bin/bash
set -e

cd /home/site/wwwroot
exec ./node_modules/.bin/next start -p "${PORT:-8080}"