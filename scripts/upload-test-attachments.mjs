/**
 * Upload specialty test patient attachments to Supabase S3 (public static/test-attachments/*).
 * Run from 3eyadahub-api: node scripts/upload-test-attachments.mjs
 * Requires SUPABASE_S3_* vars in .env (same as the API uploads service).
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const endpoint = process.env.SUPABASE_S3_ENDPOINT?.trim();
const bucket = process.env.SUPABASE_S3_BUCKET?.trim() || 'files';
const accessKeyId = process.env.SUPABASE_S3_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.SUPABASE_S3_SECRET_ACCESS_KEY?.trim();
const region = process.env.SUPABASE_S3_REGION?.trim() || 'eu-west-1';
const publicBase =
  process.env.SUPABASE_S3_URL?.trim() ||
  'https://hjluqxfmvpvtjvwzqxgi.supabase.co/storage/v1/object/public/';

if (!endpoint || !accessKeyId || !secretAccessKey) {
  console.error('Missing SUPABASE_S3_ENDPOINT / ACCESS_KEY / SECRET in .env');
  process.exit(1);
}

const assetsDir = join(root, 'src/doctor-onboarding/assets/test-attachments');
const files = [
  'cardiology-chest-xray.png',
  'dentistry-panoramic-xray.png',
  'dermatology-molesafe-report.png',
  'orthopedics-forearm-orif.png',
  'ent-sinus-waters-view.png',
  'ent-iac-mri.png',
];

const s3 = new S3Client({
  region,
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

for (const file of files) {
  const localPath = join(assetsDir, file);
  const key = `static/test-attachments/${file}`;
  const body = readFileSync(localPath);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  const url = `${publicBase}${bucket}/${key}`;
  console.log(`Uploaded ${file}\n  → ${url}`);
}

console.log('\nDone. Test attachment images are public on Supabase.');
