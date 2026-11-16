import {expect} from 'chai';
import fs from 'fs';
import {ServeRulings} from '../../src/server/routes/ServeRulings';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';

describe('ServeRulings', () => {
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;

  beforeEach(() => {
    scaffolding = new RouteTestScaffolding();
    scaffolding.url = '/rulings';
    res = new MockResponse();
  });

  it('serves every ruling of the knowledge base', async () => {
    await scaffolding.get(ServeRulings.INSTANCE, res);

    expect(res.headers.get('Content-Type')).eq('text/html; charset=utf-8');
    const data = /<script type="application\/json" id="rulings-data">(.*?)<\/script>/s.exec(res.content);
    const served: {rulings: Array<{u: string, q: string, r: string, o: string}>} = JSON.parse(data?.[1] ?? '{"rulings": []}');
    // The page is built from this file. When it changes, the page is rebuilt.
    const source: Array<{url: string, question: string, ruling: string, quote: string}> =
      fs.readFileSync('automa/bgg-rulings/rulings.jsonl', 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    expect(served.rulings.map((x) => [x.u, x.q, x.r, x.o].join('\n')).sort())
      .deep.eq(source.map((x) => [x.url, x.question, x.ruling, x.quote].join('\n')).sort());
  });

  it('compresses the page for a browser that accepts gzip', async () => {
    scaffolding.req.headers['accept-encoding'] = 'gzip, deflate, br';
    await scaffolding.get(ServeRulings.INSTANCE, res);

    expect(res.headers.get('Content-Encoding')).eq('gzip');
  });

  it('answers not modified to a browser that already has the page', async () => {
    await scaffolding.get(ServeRulings.INSTANCE, res);
    const again = new MockResponse();
    scaffolding.req.headers['if-none-match'] = res.headers.get('ETag') ?? '';
    await scaffolding.get(ServeRulings.INSTANCE, again);

    expect(again.statusCode).eq(304);
    expect(again.content).eq('');
  });
});
