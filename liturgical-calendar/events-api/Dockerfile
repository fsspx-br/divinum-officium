FROM node:22-alpine

WORKDIR /app

COPY --chown=node:node package.json event.js caldav.js feed.js server.js ./

ENV NODE_ENV=production \
    PORT=8091 \
    RADICALE_URL=http://radicale:5232 \
    RADICALE_USER=calendar-api \
    LITURGICAL_DIST=/calendar-dist

USER node

EXPOSE 8091

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8091/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
