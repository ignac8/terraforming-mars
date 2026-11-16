import crypto from 'crypto';
import fs from 'fs';
import zlib from 'zlib';
import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';

type Page = {
  plain: Buffer;
  gzip: Buffer;
  etag: string;
};

/**
 * Serves the page of official rulings, a single file built from automa/bgg-rulings/rulings.jsonl.
 *
 * The file is large and nothing in front of the server compresses it, so it is compressed on the
 * first request and kept in memory.
 */
export class ServeRulings extends Handler {
  public static readonly INSTANCE: ServeRulings = new ServeRulings();
  private page: Page | undefined;

  private constructor() {
    super();
  }

  public override get(req: Request, res: Response, _ctx: Context): Promise<void> {
    this.page ??= ServeRulings.load();
    const page = this.page;
    if (req.headers['if-none-match'] === page.etag) {
      responses.notModified(res);
      return Promise.resolve();
    }

    const acceptsGzip = String(req.headers['accept-encoding']).split(',').some((encoding) => encoding.trim() === 'gzip');
    const body = acceptsGzip ? page.gzip : page.plain;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('ETag', page.etag);
    res.setHeader('Vary', 'Accept-Encoding');
    if (acceptsGzip) {
      res.setHeader('Content-Encoding', 'gzip');
    }
    res.setHeader('Content-Length', body.length);
    res.end(body);
    return Promise.resolve();
  }

  private static load(): Page {
    const plain = fs.readFileSync('assets/rulings.html');
    return {
      plain,
      gzip: zlib.gzipSync(plain, {level: zlib.constants.Z_BEST_COMPRESSION}),
      etag: crypto.createHash('md5').update(plain).digest('hex'),
    };
  }
}
