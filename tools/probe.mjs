// Probe: valida la firma server.tool() del SDK 1.30 con zod 4
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "probe", version: "0.0.1" });

server.tool(
  "echo",
  "Devuelve el mensaje recibido",
  { message: z.string().describe("Mensaje a ecoar") },
  async ({ message }) => ({ content: [{ type: "text", text: "echo: " + message }] })
);

server.tool("health_check", "Estado del servidor", {}, async () => ({
  content: [{ type: "text", text: JSON.stringify({ ok: true }) }],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
