#!/usr/bin/env node
/** @weiseer/dns-cache-mcp — DNS/WHOIS/SSL/geo-IP cache. P-006. Apache-2.0 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLED = join(__dirname, "dns_index.json");
const REMOTE = process.env.DNS_CACHE_URL || "https://oracle.weiseer.com/dns_index.json";
const LOCAL_ONLY = !!process.env.DNS_CACHE_LOCAL_ONLY;
const TTL = 5 * 60 * 1000;
let _c = null, _t = 0;
async function load() {
  const now = Date.now();
  if (_c && now - _t < TTL) return _c;
  if (!LOCAL_ONLY) {
    try {
      const ctrl = new AbortController();
      const tt = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(REMOTE, { signal: ctrl.signal });
      clearTimeout(tt);
      if (r.ok) { _c = await r.json(); _c._source = "remote"; _t = now; return _c; }
    } catch {}
  }
  _c = JSON.parse(readFileSync(BUNDLED, "utf-8"));
  _c._source = "bundled"; _t = now;
  return _c;
}
function _prov(d) { return { snapshot_as_of: d.as_of, snapshot_source: d._source, served_by: "weiseer/dns-cache", served_at: new Date().toISOString() }; }
function _related() { return {
  llm_routing: "npx -y @weiseer/llm-oracle-mcp",
  status:      "npx -y @weiseer/status-aggregator-mcp",
  cve_cache:   "npx -y @weiseer/cve-cache-mcp",
  org_index:   "https://github.com/weiseer"
}; }

async function lookupDns({ domain, record_type = "A" }) {
  if (!domain) return { error: "domain required" };
  const d = await load();
  const e = (d.domains || []).find(x => x.domain === domain.toLowerCase());
  if (!e) return { error: `domain '${domain}' not in cache (request via issue)`, in_cache: false };
  return { ..._prov(d), domain, record_type, records: (e.records || {})[record_type] || [], cited_resolver: e.resolver, last_resolved_at: e.last_resolved_at };
}
async function lookupWhois({ domain }) {
  if (!domain) return { error: "domain required" };
  const d = await load();
  const e = (d.domains || []).find(x => x.domain === domain.toLowerCase());
  if (!e || !e.whois) return { error: `whois for '${domain}' not in cache` };
  return { ..._prov(d), domain, ...e.whois };
}
async function lookupSslCert({ host }) {
  if (!host) return { error: "host required" };
  const d = await load();
  const e = (d.certs || []).find(x => x.host === host.toLowerCase());
  if (!e) return { error: `ssl cert for '${host}' not in cache` };
  return { ..._prov(d), host, ...e };
}
async function geoIp({ ip }) {
  if (!ip) return { error: "ip required" };
  const d = await load();
  const e = (d.geo || []).find(x => x.ip === ip);
  if (!e) return { error: `geo for ip '${ip}' not in cache` };
  return { ..._prov(d), ip, ...e };
}

const TOOLS = [
  { name: "lookup_dns", description: "DNS records cached for a domain (A/AAAA/MX/TXT/NS/CNAME). Cited resolver + timestamp.", inputSchema: { type: "object", properties: { domain: { type: "string" }, record_type: { type: "string", default: "A" } }, required: ["domain"] } },
  { name: "lookup_whois", description: "WHOIS info for a domain — registrar, registered_at, expires_at, name servers.", inputSchema: { type: "object", properties: { domain: { type: "string" } }, required: ["domain"] } },
  { name: "lookup_ssl_cert", description: "SSL cert summary for a host — issuer, subject, not_before, not_after, SAN list.", inputSchema: { type: "object", properties: { host: { type: "string" } }, required: ["host"] } },
  { name: "geo_ip", description: "Geo + ASN for an IP — country, city, asn, asn_org.", inputSchema: { type: "object", properties: { ip: { type: "string" } }, required: ["ip"] } },
];
const HANDLERS = { lookup_dns: lookupDns, lookup_whois: lookupWhois, lookup_ssl_cert: lookupSslCert, geo_ip: geoIp };
const server = new Server({ name: "dns-cache", version: "0.1.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const h = HANDLERS[name];
  if (!h) return { content: [{ type: "text", text: JSON.stringify({ error: `unknown tool: ${name}` }) }], isError: true };
  try { return { content: [{ type: "text", text: JSON.stringify(await h(args || {}), null, 2) }] }; }
  catch (e) { return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }], isError: true }; }
});
await server.connect(new StdioServerTransport());
process.stderr.write("dns-cache connected via stdio\n");
