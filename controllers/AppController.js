import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const getStatus = (req, res) => {
  const redisStatus = redisClient.isAlive();
  const dbStatus = dbClient.isAlive();
  let statusCode = 500;
  if (redisClient && dbClient) {
    statusCode = 200;
  }
  res.status(statusCode).json({
    redis: redisStatus,
    db: dbStatus,
  });
};

const getStats = async (req, res) => {
  const usersCount = await dbClient.nbUsers();
  const filesCount = await dbClient.nbFiles();
  const statusCode = 200;
  res.status(statusCode).json({
    users: usersCount,
    files: filesCount,
  });
};

export default {
  getStatus,
  getStats,
};
