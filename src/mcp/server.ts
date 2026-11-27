#!/usr/bin/env node
/**
 * REPOSOUL MCP Server
 *
 * Implements the Model Context Protocol over stdio (JSON-RPC 2.0).
 * Start this process and configure it in .kiro/settings/mcp.json.
 *
 * Usage:
 *   node dist/mcp/server.js
 *   GITHUB_TOKEN=ghp_... node dist/mcp/server.js
 */

import * as readline from 'readline';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import {
  McpRequest,
  McpResponse,
  McpErrorResponse,
  MCP_ERROR,
} from '../types';
import { GitHubAuthConfig } from '../services/github';
import { REPOSOUL_TOOLS } from './tools';
import { McpHandlers } from './handlers';

// ─── Load environment variables ───────────────────────────────────────────────

function loadEnv() {
  dotenv.config({ debug: false });
  if (!process.env.GITHUB_TOKEN) {
    const serverDir = path.join(__dirname, '..', '..');
    const envPath = path.join(serverDir, '.env');
    if (fs.existsSync(envPath)) dotenv.config({ path: envPath, debug: false });
  }
}

loadEnv();

// ─── Build GitHub auth from environment ───────────────────────────────────────

function buildAuth(): GitHubAuthConfig {
  const oauthToken = process.env.GITHUB_OAUTH_TOKEN;
  const token = process.env.GITHUB_TOKEN;

  if (oauthToken) return { oauthToken, tokenType: 'oauth' };
  if (token) {
    // Auto-detect gho_ prefix as OAuth
    if (token.length > 100 || token.startsWith('gho_')) {
      return { oauthToken: token, tokenType: 'oauth' };
    }
    return { token, tokenType: 'pat' };
  }
  return {};
}

// ─── JSON-RPC helpers ─────────────────────────────────────────────────────────

function successResponse(id: string | number, result: unknown): McpResponse {
  return { jsonrpc: '2.0', id, result };
}

function errorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): McpErrorResponse {
  return { jsonrpc: '2.0', id, error: { code, message, data } };
}

function send(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

// ─── Server info ──────────────────────────────────────────────────────────────

const SERVER_INFO = {
  name: 'reposoul',
  version: '1.0.0',
  description: 'REPOSOUL — Open Source Resurrection Workbench. Discover abandoned repositories, analyze their condition, and generate revival blueprints.',
};

// ─── Request handler ──────────────────────────────────────────────────────────

const handlers = new McpHandlers(buildAuth());

async function handleRequest(raw: string): Promise<void> {
  let req: McpRequest;

  try {
    req = JSON.parse(raw) as McpRequest;
  } catch {
    send(errorResponse(null, MCP_ERROR.PARSE_ERROR, 'Parse error'));
    return;
  }

  const { id, method, params = {} } = req;

  try {
    switch (method) {
      // ── MCP lifecycle ────────────────────────────────────────────────────
      case 'initialize':
        send(successResponse(id, {
          protocolVersion: '2024-11-05',
          serverInfo: SERVER_INFO,
          capabilities: { tools: {} },
        }));
        return;

      case 'initialized':
        // Notification — no response needed
        return;

      case 'ping':
        send(successResponse(id, {}));
        return;

      // ── Tool listing ─────────────────────────────────────────────────────
      case 'tools/list':
        send(successResponse(id, { tools: REPOSOUL_TOOLS }));
        return;

      // ── Tool execution ───────────────────────────────────────────────────
      case 'tools/call': {
        const toolName = (params as any).name as string;
        const toolParams = ((params as any).arguments ?? {}) as Record<string, unknown>;

        if (!toolName) {
          send(errorResponse(id, MCP_ERROR.INVALID_PARAMS, 'tools/call requires a "name" parameter'));
          return;
        }

        const result = await handlers.dispatch(toolName, toolParams);

        send(successResponse(id, {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        }));
        return;
      }

      default:
        send(errorResponse(id, MCP_ERROR.METHOD_NOT_FOUND, `Method not found: ${method}`));
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    send(errorResponse(id, MCP_ERROR.INTERNAL_ERROR, message));
  }
}

// ─── Stdio transport ──────────────────────────────────────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: undefined,
  terminal: false,
});

rl.on('line', (line: string) => {
  const trimmed = line.trim();
  if (trimmed) handleRequest(trimmed);
});

rl.on('close', () => {
  process.exit(0);
});

// Log startup only to stderr so stdout stays clean for JSON-RPC
process.stderr.write(
  `[REPOSOUL MCP] Server ready. Token: ${process.env.GITHUB_TOKEN ? 'set' : 'not set'}\n`
);
