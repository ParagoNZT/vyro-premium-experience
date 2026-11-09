// Fixture only: start on the emulator host, never expose outside loopback.
import { createServer } from "node:http";
const stats = { streams: 0, guide: 0 };
const xmlTime = (value) => value.toISOString().replace(/[^0-9]/g, "").slice(0, 14) + " +0000";
createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  response.setHeader("Cache-Control", "no-store");
  const send = (value) => {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(value));
  };
  if (url.pathname === "/test-counts") return send(stats);
  if (url.searchParams.get("username") !== "partnerqa" || url.searchParams.get("password") !== "partnerqa")
    return response.writeHead(403).end();
  if (url.pathname === "/xmltv.php") {
    stats.guide++;
    const now = Date.now();
    response.setHeader("Content-Type", "application/xml");
    return response.end(`<?xml version="1.0" encoding="UTF-8"?>
      <tv><channel id="demo.qa"><display-name>Chaîne QA</display-name></channel>
      <programme channel="demo.qa" start="${xmlTime(new Date(now-900000))}" stop="${xmlTime(new Date(now+3600000))}">
      <title>Programme de test</title></programme></tv>`);
  }
  if (url.pathname !== "/player_api.php") return response.writeHead(404).end();
  switch (url.searchParams.get("action")) {
    case null: return send({user_info:{auth:1,status:"Active",active_cons:"0",max_connections:"2"},server_info:{timezone:"UTC"}});
    case "get_live_categories": return send([{category_id:"1",category_name:"Démo"}]);
    case "get_live_streams":
      stats.streams++;
      return send([{num:1,name:"Chaîne QA",stream_id:101,category_id:"1",epg_channel_id:"demo.qa",stream_type:"live"}]);
    default: return send([]);
  }
}).listen(48746, "127.0.0.1", () => console.log("Playlist et guide QA prêts sur la boucle locale."));
