FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts --save-exact \
 && npm audit --omit=dev --audit-level=high \
 && npm cache clean --force
COPY server.js security.js login-security-context.js loyalty.js registration-security.js test-mode-setup.js bot-menu-sync.js admin-broadcast-server.js broadcast-scheduler.js schedule-api-preload.js immediate-broadcast-queue-preload.js security-preload.js admin-security-preload.js ./
EXPOSE 3000 3001
USER node
CMD ["sh","-c","node test-mode-setup.js && npm start"]
