import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

async function main() {
  // Read the encrypted file
  const encFile = JSON.parse(fs.readFileSync("/root/.openclaw/media/inbound/cookies_1---c7d76531-5cba-4dbf-80a9-a66aeedc0590.json", "utf-8"));
  
  console.log("🚀 Launching browser to import HotCleaner cookies...");
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN",
  });
  
  // Spoof the extension ID
  await context.addInitScript(() => {
    // @ts-ignore
    window.chrome = { runtime: { id: "iphcomljdfghbkdcfndaijbokpgddeno" } };
  });
  
  const page = await context.newPage();
  
  // Go to the HotCleaner cookie manager page
  console.log("📍 Loading HotCleaner cookie manager...");
  await page.goto("https://www.hotcleaner.com/cookie-editor/cookie-manager.html", { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));
  
  await page.screenshot({ path: path.join(LOG_DIR, "hotcleaner-page.png") });
  
  // Try to use the page's JS decrypt functionality by posting message
  const decrypted = await page.evaluate(async (data) => {
    try {
      // The extension uses postMessage to communicate
      // Try to decrypt using Web Crypto
      const enc = new TextEncoder();
      const dec = new TextDecoder();
      const encData = Uint8Array.from(atob(data.encData), c => c.charCodeAt(0));
      const password = data.password;
      
      // HotCleaner v2 format: first 32 bytes = salt, next 12 = iv, rest = ciphertext+tag
      const salt = encData.slice(0, 32);
      const iv = encData.slice(32, 44);
      const ciphertext = encData.slice(44);
      
      const keyMaterial = await crypto.subtle.importKey(
        "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
      );
      
      // Try different iteration counts
      for (const iterations of [600000, 310000, 100000, 10000, 1000, 100]) {
        try {
          const key = await crypto.subtle.deriveKey(
            { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["decrypt"]
          );
          
          const result = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            ciphertext
          );
          
          const text = dec.decode(result);
          if (text.includes("domain") || text.startsWith("[")) {
            return { success: true, iterations, data: text.substring(0, 500) };
          }
        } catch {}
      }
      
      // Also try without salt separation (salt=first16, iv=next12)
      for (const saltLen of [16, 0]) {
        for (const ivLen of [12, 16]) {
          const s = encData.slice(0, saltLen);
          const i = encData.slice(saltLen, saltLen + ivLen);
          const c = encData.slice(saltLen + ivLen);
          
          for (const iterations of [600000, 310000, 100000, 10000, 1000]) {
            try {
              const key = await crypto.subtle.deriveKey(
                { name: "PBKDF2", salt: s.length ? s : enc.encode(""), iterations, hash: "SHA-256" },
                keyMaterial,
                { name: "AES-GCM", length: 256 },
                false,
                ["decrypt"]
              );
              
              const result = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: i },
                key,
                c
              );
              
              const text = dec.decode(result);
              if (text.includes("domain") || text.startsWith("[")) {
                return { success: true, saltLen, ivLen, iterations, data: text.substring(0, 500) };
              }
            } catch {}
          }
        }
      }
      
      return { success: false, msg: "All decrypt attempts failed" };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }, { encData: encFile.data, password: "1" });
  
  console.log("Result:", JSON.stringify(decrypted, null, 2));
  
  if (decrypted.success) {
    console.log("✅ DECRYPTED! Saving cookies...");
    // Now decrypt the full thing
    const fullDecrypted = await page.evaluate(async (data) => {
      const enc = new TextEncoder();
      const dec = new TextDecoder();
      const encData = Uint8Array.from(atob(data.encData), c => c.charCodeAt(0));
      
      const saltLen = (data as any).saltLen ?? 32;
      const ivLen = (data as any).ivLen ?? 12;
      const iterations = data.iterations;
      
      const salt = encData.slice(0, saltLen);
      const iv = encData.slice(saltLen, saltLen + ivLen);
      const ciphertext = encData.slice(saltLen + ivLen);
      
      const keyMaterial = await crypto.subtle.importKey(
        "raw", enc.encode(data.password), "PBKDF2", false, ["deriveKey"]
      );
      
      const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );
      
      const result = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv }, key, ciphertext
      );
      
      return dec.decode(result);
    }, { ...decrypted, encData: encFile.data, password: "1" });
    
    fs.writeFileSync(path.join(__dirname, "..", "data", "cookies_plain.json"), fullDecrypted);
    console.log("💾 Saved decrypted cookies!");
  }
  
  await browser.close();
}

main().catch(console.error);
