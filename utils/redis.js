import redis from 'redis';
import util from 'util';

class RedisClient {
  constructor() {
    this.client = redis.createClient();
    this.client.on('error', (err) => console.log(err));
    this.connected = false;
    this.client.on('connect', () => {
      this.connected = true;
    });
  }

  isAlive() {
    return this.connected;
  }

  async get(key) {
    const getAsync = util.promisify(this.client.get).bind(this.client);
    try {
      const value = await getAsync(key);
      return value;
    } catch (err) {
      console.log(err);
      return null;
    }
  }

  async set(key, value, duration) {
    const setAsync = util.promisify(this.client.set).bind(this.client);
    try {
      await setAsync(key, value, 'EX', duration);
    } catch (err) {
      console.log(err);
    }
  }

  async del(key) {
    const delAsync = util.promisify(this.client.del).bind(this.client);
    try {
      await delAsync(key);
    } catch (err) {
      console.log(err);
    }
  }
}

const redisClient = new RedisClient();
export default redisClient;
