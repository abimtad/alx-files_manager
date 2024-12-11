import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const postNew = async (req, res) => {
  try {
    const db = dbClient.client.db(dbClient.database);
    const collection = db.collection('users');
    if (!req.body.email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!req.body.password) {
      return res.status(400).json({ error: 'Missing password' });
    }
    const existingUser = await collection.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({ error: 'Already exist' });
    }
    const result = await collection.insertOne({
      email: req.body.email,
      password: sha1(req.body.password),
    });
    return res.status(201).json({
      id: result.insertedId,
      email: result.ops[0].email,
    });
  } catch (err) {
    console.log(err);
    return err;
  }
};

const getMe = async (req, res) => {
  const token = req.headers['x-token'];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  const user = await dbClient.client.db(dbClient.database).collection('users').findOne({ _id: ObjectId(userId) });
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.status(200).json({
    id: user._id,
    email: user.email,
  });
};

export default {
  postNew,
  getMe,
};
