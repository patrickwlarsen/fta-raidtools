import { JWT } from "google-auth-library";
import * as fs from "fs";
import * as https from "https";
import { AppConfig } from "./config";

function extractSheetId(url: string): string {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return url.trim();
}

function createAuthClient(keyPath: string): JWT {
  const keyData = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
  return new JWT({
    email: keyData.client_email,
    key: keyData.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function apiRequest(url: string, token: string, method = "GET", body?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`Sheets API error (HTTP ${res.statusCode}): ${data}`));
        }
      });
    });

    req.on("error", (err) => reject(new Error(`Network error: ${err.message}`)));
    if (body) req.write(body);
    req.end();
  });
}

export async function fetchSheetData(config: AppConfig, sheetName: string): Promise<string[][]> {
  if (!config.serviceAccountKeyPath) {
    throw new Error("No service account key configured. Go to Settings.");
  }
  const auth = createAuthClient(config.serviceAccountKeyPath);
  const credentials = await auth.authorize();
  const token = credentials.access_token;
  if (!token) throw new Error("Failed to obtain access token.");

  const sheetId = extractSheetId(config.googleSheetUrl);
  const range = encodeURIComponent(sheetName);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`;

  const raw = await apiRequest(url, token);
  const json = JSON.parse(raw);
  return json.values ?? [];
}

export async function writeSheetData(
  config: AppConfig,
  range: string,
  values: string[][],
): Promise<void> {
  if (!config.serviceAccountKeyPath) {
    throw new Error("No service account key configured. Go to Settings.");
  }
  const auth = createAuthClient(config.serviceAccountKeyPath);
  const credentials = await auth.authorize();
  const token = credentials.access_token;
  if (!token) throw new Error("Failed to obtain access token.");

  const sheetId = extractSheetId(config.googleSheetUrl);
  const encodedRange = encodeURIComponent(range);

  // Clear existing data first so stale rows beyond the new data are removed
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedRange}:clear`;
  await apiRequest(clearUrl, token, "POST", JSON.stringify({}));

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`;
  await apiRequest(url, token, "PUT", JSON.stringify({ values }));
}
