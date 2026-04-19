import { WebSocketServer } from "ws";

let wss;

export function initWsHub(server) {
  wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (socket) => {
    socket.send(JSON.stringify({ type: "connected", ts: Date.now() }));
  });
}

export function broadcast(type, payload) {
  if (!wss) return;
  const body = JSON.stringify({ type, payload, ts: Date.now() });
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(body);
    }
  }
}
