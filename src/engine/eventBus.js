'use strict';
/**
 * Server-Sent Events event bus.
 * Any module that changes tournament state calls eventBus.emit(type, payload).
 * Every connected browser client receives the push immediately.
 *
 * Works identically on localhost, EC2, and behind an NGINX reverse proxy —
 * no WebSocket upgrade needed, no special cloud config.
 */

const clients = new Set();

/** Register an SSE response object and return a cleanup function. */
function subscribe(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // tell NGINX not to buffer SSE
  res.flushHeaders();
  // heartbeat every 25 s keeps the connection alive through proxies and firewalls
  const hb = setInterval(() => safeWrite(res, ': heartbeat\n\n'), 25000);
  clients.add(res);
  return function cleanup() {
    clearInterval(hb);
    clients.delete(res);
  };
}

/** Push a named event + JSON payload to every connected browser. */
function emit(type, payload) {
  if (!clients.size) return;
  const data = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  clients.forEach((res) => safeWrite(res, data));
}

function safeWrite(res, data) {
  try { res.write(data); } catch (_) { clients.delete(res); }
}

function clientCount() { return clients.size; }

module.exports = { subscribe, emit, clientCount };
