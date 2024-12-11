import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const getConnect = async (req, res) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Unauthorized' });
  let userData = header.split(' ');
  userData = Buffer.from(userData[1], 'base64').toString('utf-8').split(':');
  const email = userData[0];
  const password = sha1(userData[1]);
  const existingUser = await dbClient.client.db(dbClient.database).collection('users').findOne({
    email,
    password,
  });
  if (!existingUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = uuidv4();
  const key = `auth_${token}`;
  await redisClient.set(key, existingUser._id.toString(), 86400000);
  return res.status(200).json({
    token,
  });
};

const getDisconnect = async (req, res) => {
  const token = req.headers['x-token'];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  await redisClient.del(key);
  return res.status(204).send();
};

export default {
  getConnect,
  getDisconnect,
};
