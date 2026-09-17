FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts --save-exact \
 && npm audit --omit=dev --audit-level=high \
 && npm cache clean --force
COPY server.js security.js login-security-context.js loyalty.js customer-code.js loyalty-contact-gate-preload.js registration-security.js account-password-preload.js test-mode-setup.js bot-menu-sync.js admin-broadcast-server.js broadcast-scheduler.js schedule-api-preload.js immediate-broadcast-queue-preload.js broadcast-control-preload.js security-preload.js admin-security-preload.js integrations-preload.js cashier-preload.js analytics-detail-preload.js cookie-lax-preload.js runtime-diagnostics-preload.js login-access-fix-preload.js ./
EXPOSE 3000 3001
USER node
CMD ["sh","-c","node test-mode-setup.js && node --import ./loyalty-contact-gate-preload.js --import ./security-preload.js --import ./login-access-fix-preload.js --import ./account-password-preload.js --import ./integrations-preload.js --import ./cashier-preload.js --import ./analytics-detail-preload.js --import ./cookie-lax-preload.js --import ./runtime-diagnostics-preload.js server.js"]
