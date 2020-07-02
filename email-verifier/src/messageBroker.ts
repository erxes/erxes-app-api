import * as amqplib from 'amqplib';
import * as dotenv from 'dotenv';
import { bulk, single } from './api';
import { validateBulkPhones, validateSinglePhone } from './apiPhoneVerifier';
import { debugBase } from './utils';

dotenv.config();

const { NODE_ENV, RABBITMQ_HOST = 'amqp://localhost' } = process.env;

let conn;
let channel;

export const initConsumer = async () => {
  try {
    conn = await amqplib.connect(RABBITMQ_HOST);
    channel = await conn.createChannel();

    // listen for erxes api ===========
    await channel.assertQueue('erxes-api:email-verifier-notification');

    channel.consume('erxes-api:email-verifier-notification', async msg => {
      if (msg !== null) {
        const { action, data } = JSON.parse(msg.content.toString());

        debugBase(`Receiving queue data from erxes-api`, action, data);

        if (action === 'emailVerify') {
          const { emails, email } = data;
          email ? single(email) : bulk(emails);
        } else if (action === 'phoneVerify') {
          const { phones, phone } = data;
          phone ? validateSinglePhone(phone) : validateBulkPhones(phones);
        }

        channel.ack(msg);
      }
    });
  } catch (e) {
    debugBase(e.message);
  }
};

interface IQueueData {
  action: string;
  data: any;
}

export const sendMessage = async (queueName: string, data: IQueueData) => {
  if (NODE_ENV === 'test') {
    return;
  }

  debugBase(`Sending data from email verifier to ${queueName}`, data);

  try {
    await channel.assertQueue(queueName);
    await channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data || {})));
  } catch (e) {
    debugBase(e.message);
  }
};

/**
 * Health check rabbitMQ
 */
export const rabbitMQStatus = async () => {
  return new Promise((resolve, reject) => {
    // tslint:disable-next-line:no-submodule-imports
    import('amqplib/callback_api')
      .then(amqp => {
        amqp.connect(RABBITMQ_HOST, error => {
          if (error) {
            return reject(error);
          }

          return resolve('ok');
        });
      })
      .catch(e => reject(e));
  });
};
