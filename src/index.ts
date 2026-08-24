import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN must be set");
  process.exit(1);
}

const defaultChatId = process.env.TELEGRAM_DEFAULT_CHAT_ID;

// Instantiate the bot without polling to avoid conflicts with stdio transport
const bot = new TelegramBot(token, { polling: false });

const server = new Server(
  {
    name: "telegram-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "telegram_get_me",
        description: "Get information about the Telegram Bot itself. Useful for testing connection.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "telegram_send_message",
        description: "Send a message to a Telegram chat. Requires chat_id and text.",
        inputSchema: {
          type: "object",
          properties: {
            chat_id: {
              type: "string",
              description: "Target chat ID or username (e.g. '@channelname'). If not provided, the default chat ID from environment variables will be used.",
            },
            text: {
              type: "string",
              description: "The message text to send.",
            },
            parse_mode: {
              type: "string",
              enum: ["Markdown", "HTML", "MarkdownV2"],
              description: "Formatting mode for the message text.",
            },
          },
          required: ["text"],
        },
      },
      {
        name: "telegram_get_updates",
        description: "Get updates (new messages) sent to the Telegram Bot. Useful for reading incoming messages.",
        inputSchema: {
          type: "object",
          properties: {
            offset: {
              type: "number",
              description: "Identifier of the first update to be returned. Must be greater by one than the highest among the identifiers of previously received updates.",
            },
            limit: {
              type: "number",
              description: "Limits the number of updates to be retrieved. Values between 1-100 are accepted. Defaults to 100.",
            },
            timeout: {
              type: "number",
              description: "Timeout in seconds for long polling. Defaults to 0.",
            },
          },
        },
      },
    ],
  };
});

// Handle tool execution requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "telegram_get_me": {
        const me = await bot.getMe();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(me, null, 2),
            },
          ],
        };
      }
      case "telegram_send_message": {
        const text = args?.text as string;
        const parse_mode = args?.parse_mode as TelegramBot.ParseMode | undefined;
        let chat_id = args?.chat_id as string | number | undefined;

        if (!chat_id) {
          if (!defaultChatId) {
            throw new Error("chat_id was not provided and TELEGRAM_DEFAULT_CHAT_ID is not configured.");
          }
          chat_id = defaultChatId;
        }

        const message = await bot.sendMessage(chat_id, text, { parse_mode });
        return {
          content: [
            {
              type: "text",
              text: `Message successfully sent. Message ID: ${message.message_id} to Chat ID: ${chat_id}`,
            },
          ],
        };
      }
      case "telegram_get_updates": {
        const offset = args?.offset as number | undefined;
        const limit = args?.limit as number | undefined;
        const timeout = args?.timeout as number | undefined;

        const updates = await bot.getUpdates({ offset, limit, timeout });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(updates, null, 2),
            },
          ],
        };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message || String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

const app = express();

// Enable CORS for MCP clients
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

// Parse JSON request bodies (needed for /messages endpoint)
app.use(express.json());

// Keep track of active transports
const transports: Record<string, SSEServerTransport> = {};

app.get("/sse", async (req, res) => {
  console.error("New SSE connection request received");
  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;

  res.on("close", () => {
    console.error(`Session ${transport.sessionId} closed`);
    delete transports[transport.sessionId];
  });

  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];

  if (!transport) {
    res.status(400).send("Session not found or expired");
    return;
  }

  await transport.handlePostMessage(req, res);
});

async function main() {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.error(`Telegram MCP server running on SSE at http://localhost:${port}`);
    console.error(`SSE endpoint: http://localhost:${port}/sse`);
  });
}

main().catch((error) => {
  console.error("Fatal error in main:", error);
  process.exit(1);
});
