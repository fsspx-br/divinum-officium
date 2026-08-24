FROM node:22-alpine

WORKDIR /app

COPY --chown=node:node package.json server.js store.js ./

RUN mkdir -p /data && chown node:node /data

ENV NODE_ENV=production \
    PORT=8090 \
    DATA_FILE=/data/custom-translations.json

USER node

EXPOSE 8090
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8090/api/translations').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
