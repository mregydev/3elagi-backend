import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export type UploadFileResult = {
  message: string;
  path: string;
  url: string;
  /**
   * Storage object path. For Supabase equals `path`. For S3/GCS/local, the `/objects/...` or
   * `/local-uploads/...` suffix used by `/uploads/serve/*` (legacy shape).
   */
  objectPath: string;
};
import * as path from 'path';
import * as fs from 'fs';

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';

export const ALLOWED_UPLOAD_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'audio/m4a',
  'audio/mp4',
  'audio/mpeg',
  'audio/aac',
  'audio/x-m4a',
  'audio/x-caf',
  'video/mp4',
  'video/quicktime',
] as const;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function createReplitStorage(): Storage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const credentials: any = {
    audience: 'replit',
    subject_token_type: 'access_token',
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: 'external_account',
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: 'json',
        subject_token_field_name: 'access_token',
      },
    },
    universe_domain: 'googleapis.com',
  };
  return new Storage({ credentials, projectId: '' });
}

/** Parse `supabase/<bucket>/<objectKey...>` from proxy paths */
function parseSupabaseProxyPath(raw: string): { bucket: string; objectKey: string } | null {
  const trimmed = raw.replace(/^\/+/, '');
  if (!trimmed.startsWith('supabase/')) return null;
  const rest = trimmed.slice('supabase/'.length);
  const i = rest.indexOf('/');
  if (i <= 0) return null;
  const bucket = rest.slice(0, i);
  const objectKey = rest.slice(i + 1);
  if (!bucket || !objectKey) return null;
  return { bucket, objectKey };
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private supabase: SupabaseClient | null = null;
  private supabaseBucket: string | null = null;
  private storage: Storage | null = null;
  private bucketId: string | null = null;
  private s3: S3Client | null = null;
  private s3Bucket: string | null = null;

  constructor() {
    const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    // Bucket name must match a bucket in Supabase Dashboard → Storage (not the S3-compatible bucket env).
    const storageBucket = (
      process.env.SUPABASE_BUCKET ||
      process.env.SUPABASE_STORAGE_BUCKET ||
      'files'
    ).trim();

    if (supabaseUrl && serviceKey) {
      this.supabase = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });
      this.supabaseBucket = storageBucket;
      this.logger.log(`Supabase Storage enabled (bucket: ${storageBucket})`);
    }

    const s3Endpoint = process.env.SUPABASE_S3_ENDPOINT || '';
    const s3Bucket = process.env.SUPABASE_S3_BUCKET || '';
    const accessKeyId = process.env.SUPABASE_S3_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.SUPABASE_S3_SECRET_ACCESS_KEY || '';
    const region = process.env.SUPABASE_S3_REGION || 'us-east-1';
    if (s3Endpoint && s3Bucket && accessKeyId && secretAccessKey) {
      this.s3 = new S3Client({
        region,
        endpoint: s3Endpoint,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
      });
      this.s3Bucket = s3Bucket;
    }

    this.bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || null;
    if (this.bucketId) {
      this.storage = createReplitStorage();
    }
  }

  parseBase64ToMulterFile(
    file: string,
    filename: string,
    mimetype?: string,
  ): Express.Multer.File {
    const trimmed = file.trim();
    let mime = mimetype?.trim() || 'application/octet-stream';
    let payload = trimmed;

    const dataUrlMatch = /^data:([^;]+);base64,(.+)$/is.exec(trimmed);
    if (dataUrlMatch) {
      mime = dataUrlMatch[1].trim();
      payload = dataUrlMatch[2].replace(/\s/g, '');
    } else {
      payload = trimmed.replace(/\s/g, '');
    }

    if (!ALLOWED_UPLOAD_MIMES.includes(mime as (typeof ALLOWED_UPLOAD_MIMES)[number])) {
      throw new BadRequestException(
        'Only JPEG, PNG, WebP, GIF images and PDF files are allowed',
      );
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(payload, 'base64');
    } catch {
      throw new BadRequestException('Invalid base64 file data');
    }

    if (!buffer.length) {
      throw new BadRequestException('Empty file data');
    }
    if (buffer.length > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('File exceeds 10 MB limit');
    }

    return {
      fieldname: 'file',
      originalname: filename,
      encoding: '7bit',
      mimetype: mime,
      size: buffer.length,
      buffer,
      destination: '',
      filename: '',
      path: '',
      stream: null as unknown as Express.Multer.File['stream'],
    };
  }

  async uploadFileFromBase64(
    file: string,
    filename: string,
    mimetype?: string,
  ): Promise<UploadFileResult> {
    const multerFile = this.parseBase64ToMulterFile(file, filename, mimetype);
    return this.uploadFile(multerFile);
  }

  async uploadFile(file: Express.Multer.File): Promise<UploadFileResult> {
    if (this.supabase && this.supabaseBucket) {
      this.logger.log('uploading to supabase storage');
      return this.uploadToSupabaseStorage(file);
    }
    if (this.s3 && this.s3Bucket) {
      file.filename="lolo.jpg"
      this.logger.log('uploading to s3 storage');
      if(!file) {
        this.logger.error('file is null');
       
      }
     // this.logger.log(JSON.stringify(file));
      return this.uploadToSupabaseS3(file);
    }

    if (this.storage && this.bucketId) {
      this.logger.log('uploading to gcs storage');
      return this.uploadToGCS(file);
    }
    this.logger.log('uploading to local');
    return this.uploadToLocal(file);
  }

  private publicDomain(): string {
    const explicit = (process.env.PUBLIC_BASE_URL || '').trim();
    if (explicit) return explicit.replace(/\/+$/, '');
    const replit = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '';
    return replit.replace(/\/+$/, '');
  }

  private makeServeUrl(objectPath: string): string {
    const domain = this.publicDomain();
    return `${domain}/3eyadahub-api/uploads/serve${objectPath}`;
  }

  /** Normalize stored file paths to an absolute browser URL for API responses. */
  resolvePublicFileUrl(urlOrPath: string | null | undefined): string | null {
    const trimmed = (urlOrPath ?? '').trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    const serveSuffix = trimmed.match(
      /\/uploads\/serve(\/(?:objects|local-uploads)\/.+)$/i,
    );
    if (serveSuffix) {
      return this.makeServeUrl(serveSuffix[1]);
    }

    if (trimmed.startsWith('/objects/') || trimmed.startsWith('/local-uploads/')) {
      return this.makeServeUrl(trimmed);
    }

    if (trimmed.startsWith('/3eyadahub-api/uploads/serve/')) {
      const domain = this.publicDomain();
      return domain ? `${domain}${trimmed}` : trimmed;
    }

    if (!trimmed.startsWith('/')) {
      return this.makeServeUrl(`/objects/${trimmed.replace(/^\/+/, '')}`);
    }

    const domain = this.publicDomain();
    return domain ? `${domain}${trimmed}` : trimmed;
  }

  /**
   * Public file URL: SUPABASE_S3_URL + /storage/v1/object/public/{bucket}/{objectKey}
   */
  private absolutePublicFileUrl(
    bucket: string,
    objectKey: string,
    fallback: string,
  ): string {
    const base = (process.env.SUPABASE_S3_URL || '').trim();
    if (!base) return fallback;
    const key = objectKey.replace(/^\/+/, '');
    return `${base}${bucket}/${key}`;
  }

  private async uploadToSupabaseStorage(file: Express.Multer.File): Promise<UploadFileResult> {
    const bucket = this.supabaseBucket!;
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `uploads/${uuidv4()}-${safeOriginal}`;

    const { data, error } = await this.supabase!.storage.from(bucket).upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

    if (error) {
      const detail =
        error.message ||
        (typeof error === 'object' ? JSON.stringify(error) : String(error));
      this.logger.warn(`Supabase Storage upload failed (bucket=${bucket}): ${detail}`);
      throw new BadRequestException(detail || 'Upload failed');
    }

    const { data: publicUrlData } = this.supabase!.storage.from(bucket).getPublicUrl(data.path);
    const sdkUrl = (publicUrlData.publicUrl || '').trim();
    const url = this.absolutePublicFileUrl(bucket, data.path, sdkUrl);

    return {
      message: 'File uploaded successfully',
      path: data.path,
      url,
      objectPath: data.path,
    };
  }

  private async uploadToSupabaseS3(file: Express.Multer.File): Promise<UploadFileResult> {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectName = `uploads/${uuidv4()}-${safeName}`;

    await this.s3!.send(
      new PutObjectCommand({
        Bucket: this.s3Bucket!,
        Key: objectName,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const legacyPath = `/objects/${objectName}`;
    const url = this.absolutePublicFileUrl(
      this.s3Bucket!,
      objectName,
      this.makeServeUrl(legacyPath),
    );
    return {
      message: 'File uploaded successfully',
      path: objectName,
      url,
      objectPath: objectName,
    };
  }

  private async uploadToGCS(file: Express.Multer.File): Promise<UploadFileResult> {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectName = `uploads/${uuidv4()}-${safeName}`;
    const bucket = this.storage!.bucket(this.bucketId!);
    const gcsFile = bucket.file(objectName);

    await gcsFile.save(file.buffer, {
      contentType: file.mimetype,
      resumable: false,
    });

    const objectPath = `/objects/${objectName}`;
    const url = this.makeServeUrl(objectPath);

    return {
      message: 'File uploaded successfully',
      path: objectName,
      url,
      objectPath,
    };
  }

  private async uploadToLocal(file: Express.Multer.File): Promise<UploadFileResult> {
    const uploadDir = path.join(process.cwd(), 'local-uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${uuidv4()}-${safeName}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, file.buffer);

    const objectPath = `/local-uploads/${fileName}`;
    const url = this.makeServeUrl(objectPath);
    return {
      message: 'File uploaded successfully',
      path: fileName,
      url,
      objectPath,
    };
  }

  async getPresignedUrl(): Promise<{ uploadUrl: string; objectPath: string }> {
    return { uploadUrl: '', objectPath: '' };
  }

  async getBufferFromUrl(urlOrPath: string): Promise<Buffer | null> {
    try {
      const m = urlOrPath.match(/\/uploads\/serve(\/(?:objects|local-uploads)\/.+)$/);
      const internalPath = m ? m[1] : urlOrPath;

      if (internalPath.startsWith('/local-uploads/')) {
        const filename = internalPath.replace('/local-uploads/', '');
        const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fp = path.join(process.cwd(), 'local-uploads', safe);
        if (!fs.existsSync(fp)) return null;
        return fs.readFileSync(fp);
      }

      if (internalPath.startsWith('/objects/')) {
        const afterObjects = internalPath.replace(/^\/objects\//, '');
        const sup = parseSupabaseProxyPath(afterObjects);
        if (sup && this.supabase) {
          const { data, error } = await this.supabase.storage.from(sup.bucket).download(sup.objectKey);
          if (error || !data) return null;
          return Buffer.from(await data.arrayBuffer());
        }

        const objectName = afterObjects;
        if (this.s3 && this.s3Bucket) {
          const resp = await this.s3.send(
            new GetObjectCommand({ Bucket: this.s3Bucket, Key: objectName }),
          );
          const body = resp.Body;
          if (!body) return null;
          const chunks: Buffer[] = [];
          for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
            chunks.push(Buffer.from(chunk));
          }
          return Buffer.concat(chunks);
        }
        if (this.storage && this.bucketId) {
          const bucket = this.storage.bucket(this.bucketId);
          const [data] = await bucket.file(objectName).download();
          return data;
        }
        return null;
      }

      if (/^https?:\/\//i.test(urlOrPath)) {
        const resp = await fetch(urlOrPath);
        if (!resp.ok) return null;
        return Buffer.from(await resp.arrayBuffer());
      }
      return null;
    } catch (e) {
      this.logger.warn(`getBufferFromUrl failed: ${(e as Error).message}`);
      return null;
    }
  }

  async streamGCSFile(objectPath: string, res: import('express').Response): Promise<void> {
    const normalized = objectPath.replace(/^\/+/, '');
    const sup = parseSupabaseProxyPath(normalized);
    if (sup && this.supabase) {
      try {
        const { data, error } = await this.supabase.storage.from(sup.bucket).download(sup.objectKey);
        if (error || !data) {
          res.status(404).json({ message: 'Object not found' });
          return;
        }
        const buf = Buffer.from(await data.arrayBuffer());
        res.setHeader('Content-Type', data.type || 'application/octet-stream');
        res.send(buf);
      } catch {
        res.status(404).json({ message: 'Object not found' });
      }
      return;
    }

    if (this.s3 && this.s3Bucket) {
      try {
        const file = await this.s3.send(
          new GetObjectCommand({ Bucket: this.s3Bucket, Key: normalized }),
        );
        if (file.ContentType) {
          res.setHeader('Content-Type', file.ContentType);
        }
        if (!file.Body) {
          res.status(404).json({ message: 'Object not found' });
          return;
        }
        (file.Body as unknown as NodeJS.ReadableStream).pipe(res);
      } catch {
        res.status(404).json({ message: 'Object not found' });
      }
      return;
    }

    if (!this.storage || !this.bucketId) {
      res.status(404).json({ message: 'Object storage not configured' });
      return;
    }
    try {
      const bucket = this.storage.bucket(this.bucketId);
      const file = bucket.file(normalized);
      const [metadata] = await file.getMetadata();
      res.setHeader('Content-Type', (metadata.contentType as string) || 'application/octet-stream');
      file.createReadStream().pipe(res);
    } catch {
      res.status(404).json({ message: 'Object not found' });
    }
  }
}
