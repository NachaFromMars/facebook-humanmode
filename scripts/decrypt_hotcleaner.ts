/**
 * Use browser to decrypt HotCleaner cookies via their own page
 */
import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Read the encrypted cookie file
  const cookieData = JSON.parse(fs.readFileSync("/root/.openclaw/media/inbound/cookies_1---c7d76531-5cba-4dbf-80a9-a66aeedc0590.json", "utf-8"));
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Navigate to a blank page and use Web Crypto API to try decryption
  await page.goto("about:blank");
  
  const result = await page.evaluate(async (data: {data: string, password: string}) => {
    const { data: encB64, password } = data;
    const encrypted = Uint8Array.from(atob(encB64), c => c.charCodeAt(0));
    
    const results: string[] = [];
    
    // Try multiple key derivation + decryption approaches
    async function tryDecrypt(keyMaterial: CryptoKey, iv: Uint8Array, ciphertext: Uint8Array, label: string) {
      for (const keyLen of [128, 256]) {
        for (const algo of ["AES-GCM", "AES-CBC"]) {
          try {
            const key = await crypto.subtle.deriveKey(
              { name: "PBKDF2", salt: iv.slice(0, 16), iterations: 100000, hash: "SHA-256" },
              keyMaterial,
              { name: algo, length: keyLen },
              false,
              ["decrypt"]
            );
            
            let decrypted;
            if (algo === "AES-GCM") {
              decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                key,
                ciphertext
              );
            } else {
              decrypted = await crypto.subtle.decrypt(
                { name: "AES-CBC", iv: iv },
                key,
                ciphertext
              );
            }
            
            const text = new TextDecoder().decode(decrypted);
            if (text.startsWith("[") || text.startsWith("{")) {
              return `✅ ${label} ${algo}-${keyLen}: ${text.substring(0, 200)}`;
            }
          } catch {}
        }
      }
      
      // Also try importKey raw
      for (const keyLen of [16, 32]) {
        for (const algo of ["AES-GCM", "AES-CBC"]) {
          try {
            const enc = new TextEncoder();
            const rawKey = new Uint8Array(keyLen);
            const pwBytes = enc.encode(password);
            rawKey.set(pwBytes.slice(0, keyLen));
            
            const key = await crypto.subtle.importKey(
              "raw", rawKey, algo, false, ["decrypt"]
            );
            
            let decrypted;
            if (algo === "AES-GCM") {
              decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                key,
                ciphertext
              );
            } else {
              decrypted = await crypto.subtle.decrypt(
                { name: "AES-CBC", iv: iv },
                key,
                ciphertext
              );
            }
            
            const text = new TextDecoder().decode(decrypted);
            if (text.startsWith("[") || text.startsWith("{")) {
              return `✅ RAW ${algo}-${keyLen*8}: ${text.substring(0, 200)}`;
            }
          } catch {}
        }
      }
      
      return null;
    }
    
    // Import password as key material
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
    );
    
    // Try various iv/salt positions
    for (const ivStart of [0, 16, 32]) {
      for (const ivLen of [12, 16]) {
        const iv = encrypted.slice(ivStart, ivStart + ivLen);
        const ct = encrypted.slice(ivStart + ivLen);
        
        const r = await tryDecrypt(keyMaterial, iv, ct, `iv@${ivStart}:${ivLen}`);
        if (r) results.push(r);
      }
    }
    
    return results.length > 0 ? results : ["❌ All Web Crypto methods failed"];
  }, { data: cookieData.data, password: "1" });
  
  console.log(result);
  
  await browser.close();
}

main().catch(console.error);
