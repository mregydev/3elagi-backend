import { Injectable, Logger } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';

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

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private storage: Storage | null = null;
  private bucketId: string | null = null;

  constructor() {
    this.bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || null;
    if (this.bucketId) {
      this.storage = createReplitStorage();
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<{ url: string; objectPath: string }> {
    if (this.storage && this.bucketId) {
      return this.uploadToGCS(file);
    }
    return this.uploadToLocal(file);
  }

  private async uploadToGCS(file: Express.Multer.File): Promise<{ url: string; objectPath: string }> {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectName = `uploads/${uuidv4()}-${safeName}`;
    const bucket = this.storage!.bucket(this.bucketId!);
    const gcsFile = bucket.file(objectName);

    await gcsFile.save(file.buffer, {
      contentType: file.mimetype,
      resumable: false,
    });

    const objectPath = `/objects/${objectName}`;
    const domain = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : '';
    const url = `${domain}/3eyadahub-api/uploads/serve${objectPath}`;

    return { url, objectPath };
  }

  private async uploadToLocal(file: Express.Multer.File): Promise<{ url: string; objectPath: string }> {
    const uploadDir = path.join(process.cwd(), 'local-uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${uuidv4()}-${safeName}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, file.buffer);

    const objectPath = `/local-uploads/${fileName}`;
    const domain = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : '';
    const url = `${domain}/3eyadahub-api/uploads/serve${objectPath}`;
    return { url, objectPath };
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
        if (!this.storage || !this.bucketId) return null;
        const objectName = internalPath.replace('/objects/', '');
        const bucket = this.storage.bucket(this.bucketId);
        const [data] = await bucket.file(objectName).download();
        return data;
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
    if (!this.storage || !this.bucketId) {
      res.status(404).json({ message: 'Object storage not configured' });
      return;
    }
    try {
      const bucket = this.storage.bucket(this.bucketId);
      const file = bucket.file(objectPath);
      const [metadata] = await file.getMetadata();
      res.setHeader('Content-Type', (metadata.contentType as string) || 'application/octet-stream');
      file.createReadStream().pipe(res);
    } catch {
      res.status(404).json({ message: 'Object not found' });
    }
  }
}
