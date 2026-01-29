import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue as QueueMQ } from 'bullmq';
import express from 'express';

const redisOptions = {
  port: 6379,
  host: 'localhost',
  password: '',
  tls: false,
};

const createQueueMQ = (name) => new QueueMQ(name, { connection: redisOptions });

// NOTE: Do not create workers here - they compete with NestJS processors!
// Bull Board is only for monitoring queues, not processing jobs.
// The actual job processing is handled by NestJS processors in the main application.

const run = async () => {
  const libraryScanQueue = createQueueMQ('library-scan');
  const audioScanQueue = createQueueMQ('audio-scan');
  const bpmUpdateQueue = createQueueMQ('bpm-update');
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

  app.listen(2000, () => {
    console.log('Bull Board UI running on http://localhost:2000/ui');
    console.log('Make sure Redis is running on port 6379 by default');
    console.log('Note: Job processing is handled by NestJS processors, not this monitoring tool');
  });
};

// eslint-disable-next-line no-console
run().catch((e) => console.error(e));
