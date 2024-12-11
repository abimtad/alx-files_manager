import fs from 'fs';
import { lookup } from 'mime-types';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const postUpload = async (req, res) => {
  const token = req.headers['x-token'];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  const user = await dbClient.client.db(dbClient.database).collection('users').findOne({ _id: ObjectId(userId) });
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const types = ['folder', 'file', 'image'];
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  const { type } = req.body;
  if (!types.includes(type)) return res.status(400).json({ error: 'Missing type' });
  const { data } = req.body;
  if (!data && type !== 'folder') return res.status(400).json({ error: 'Missing data' });
  const { parentId } = req.body;
  if (parentId) {
    const existingFile = await dbClient.client.db(dbClient.database).collection('files').findOne({ _id: ObjectId(parentId) });
    if (!existingFile) return res.status(400).json({ error: 'Parent not found' });
    if (existingFile.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
  }
  const { isPublic } = req.body;
  if (type === 'folder') {
    const result = await dbClient.client.db(dbClient.database).collection('files').insertOne({
      userId,
      name,
      type,
      parentId: parentId || 0,
      isPublic: isPublic || false,
    });
    return res.status(201).json({
      id: result.insertedId,
      userId,
      name,
      type,
      parentId: parentId || 0,
      isPublic: isPublic || false,
    });
  }
  const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
  fs.access(folderPath, (err) => {
    if (err) {
      fs.mkdir(folderPath, (err) => {
        throw err;
      });
    }
  });
  const filePath = `${folderPath}/${uuidv4()}`;
  const fileContent = Buffer.from(data, 'base64').toString('utf-8');
  fs.writeFile(filePath, fileContent, (err) => {
    if (err) console.log(err);
  });
  const result = await dbClient.client.db(dbClient.database).collection('files').insertOne({
    userId,
    name,
    type,
    parentId: parentId || 0,
    isPublic: isPublic || false,
    localPath: filePath,
  });
  return res.status(201).json({
    id: result.insertedId,
    userId,
    name,
    type,
    parentId: parentId || 0,
    isPublic: isPublic || false,
  });
};

const getShow = async (req, res) => {
  const token = req.headers['x-token'];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  const user = await dbClient.client.db(dbClient.database).collection('users').findOne({ _id: ObjectId(userId) });
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { id } = req.params;
  const file = await dbClient.client.db(dbClient.database).collection('files').findOne({
    _id: ObjectId(id),
    userId,
  });
  if (!file) return res.status(404).json({ error: 'Not found' });
  return res.status(200).json({
    id: file._id.toString(),
    userId: file.userId,
    name: file.name,
    type: file.type,
    isPublic: file.isPublic,
    parentId: file.parentId,
  });
};

const getIndex = async (req, res) => {
  const token = req.headers['x-token'];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  const user = await dbClient.client.db(dbClient.database).collection('users').findOne({ _id: ObjectId(userId) });
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const parentId = req.params.parentId || 0;
  const page = req.params.page || 0;
  const maxPageSize = 20;
  const pipeline = [
    { $match: { parentId } },
    { $skip: (page) * maxPageSize },
    { $limit: maxPageSize },
  ];
  const results = await dbClient.client.db(dbClient.database).collection('files').aggregate(pipeline).toArray();
  return res.status(200).send(results);
};

const putPublish = async (req, res) => {
  const token = req.headers['x-token'];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  const user = await dbClient.client.db(dbClient.database).collection('users').findOne({ _id: ObjectId(userId) });
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { id } = req.params;
  const file = await dbClient.client.db(dbClient.database).collection('files').findOne({
    _id: ObjectId(id),
    userId,
  });
  if (!file) return res.status(404).json({ error: 'Not found' });
  await dbClient.client.db(dbClient.database).collection('files').updateOne(
    { _id: ObjectId(id) },
    { $set: { isPublic: true } },
  );
  return res.status(200).json({
    id: file._id.toString(),
    userId: file.userId,
    name: file.name,
    type: file.type,
    isPublic: true,
    parentId: file.parentId,
  });
};

const putUnpublish = async (req, res) => {
  const token = req.headers['x-token'];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  const user = await dbClient.client.db(dbClient.database).collection('users').findOne({ _id: ObjectId(userId) });
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { id } = req.params;
  const file = await dbClient.client.db(dbClient.database).collection('files').findOne({
    _id: ObjectId(id),
    userId,
  });
  if (!file) return res.status(404).json({ error: 'Not found' });
  await dbClient.client.db(dbClient.database).collection('files').updateOne(
    { _id: ObjectId(id) },
    { $set: { isPublic: false } },
  );
  return res.status(200).json({
    id: file._id.toString(),
    userId: file.userId,
    name: file.name,
    type: file.type,
    isPublic: false,
    parentId: file.parentId,
  });
};

async function checkFileExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}

const getFile = async (req, res) => {
  const { id } = req.params;
  const file = await dbClient.client.db(dbClient.database).collection('files').findOne({
    _id: ObjectId(id),
  });
  if (!file) return res.status(404).json({ error: 'Not found' });
  if (!file.isPublic) {
    const token = req.headers['x-token'];
    if (!token) return res.status(404).json({ error: 'Not found' });
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    const user = await dbClient.client.db(dbClient.database).collection('users').findOne({ _id: ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (userId !== file.userId) return res.status(404).json({ error: 'Not found' });
  }
  if (file.type === 'folder') return res.status(400).json({ error: 'A folder doesn\'t have content' });
  if (!checkFileExists(file.localPath)) return res.status(404).json({ error: 'Not found' });
  const mimeType = lookup(file.name);
  res.header('Content-Type', mimeType);
  const fileContent = Buffer.from(file.data, 'base64').toString('utf-8');
  return res.send(fileContent);
};

export default {
  postUpload,
  getShow,
  getIndex,
  putPublish,
  putUnpublish,
  getFile,
};
