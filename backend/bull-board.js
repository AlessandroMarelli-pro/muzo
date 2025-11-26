import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue as QueueMQ, Worker } from 'bullmq';
import express from 'express';

const sleep = (t) => new Promise((resolve) => setTimeout(resolve, t * 1000));

const redisOptions = {
  port: 6379,
  host: 'localhost',
  password: '',
  tls: false,
};

const createQueueMQ = (name) => new QueueMQ(name, { connection: redisOptions });

function setupBullMQProcessor(queueName) {
  new Worker(
    queueName,
    async (job) => {
      for (let i = 0; i <= 100; i++) {
        await sleep(Math.random());
        await job.updateProgress(i);
        await job.log(`Processing job at interval ${i}`);

        if (Math.random() * 200 < 1) throw new Error(`Random error ${i}`);
      }

      return { jobId: `This is the return value of job (${job.id})` };
    },
    { connection: redisOptions },
  );
}

const run = async () => {
  const libraryScanQueue = createQueueMQ('library-scan');
  const audioScanQueue = createQueueMQ('audio-scan');
  const bpmUpdateQueue = createQueueMQ('bpm-update');

  await setupBullMQProcessor(libraryScanQueue.name);
  await setupBullMQProcessor(audioScanQueue.name);
  await setupBullMQProcessor(bpmUpdateQueue.name);
  const app = express();

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/ui');
  const queues = [
    new BullMQAdapter(libraryScanQueue),
    new BullMQAdapter(audioScanQueue),
    new BullMQAdapter(bpmUpdateQueue),
  ];

  createBullBoard({
    queues,
    serverAdapter,
  });

  app.use('/ui', serverAdapter.getRouter());

  app.use('/add', (req, res) => {
    const opts = req.query.opts || {};

    if (opts.delay) {
      opts.delay = +opts.delay * 1000; // delay must be a number
    }

    exampleBullMq.add('Add', { title: req.query.title }, opts);

    res.json({
      ok: true,
    });
  });

  app.listen(2000, () => {
    console.log('Running on 2000...');
    console.log('For the UI, open http://localhost:2000/ui');
    console.log('Make sure Redis is running on port 6379 by default');
    console.log('To populate the queue, run:');
    console.log('  curl http://localhost:2000/add?title=Example');
    console.log('To populate the queue with custom options (opts), run:');
    console.log('  curl http://localhost:2000/add?title=Test&opts[delay]=9');
  });
};

// eslint-disable-next-line no-console
run().catch((e) => console.error(e));
