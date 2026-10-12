import { MongoClient } from 'mongodb'

/**
 * Lazy MongoDB connection. Nothing connects (or throws) at import time, so
 * `next build` and routes that never touch the DB work without MONGODB_URI.
 * `await clientPromise` still works everywhere: the default export is a thenable
 * that opens (and caches) one shared connection on first await.
 */
const globalWithMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>
}

export function getMongoClient(): Promise<MongoClient> {
  if (!globalWithMongo._mongoClientPromise) {
    const uri = process.env.MONGODB_URI
    if (!uri) {
      return Promise.reject(new Error('Please set MONGODB_URI in your environment'))
    }
    const p = new MongoClient(uri, {}).connect()
    // Don't cache a failed connection forever.
    p.catch(() => {
      if (globalWithMongo._mongoClientPromise === p) globalWithMongo._mongoClientPromise = undefined
    })
    globalWithMongo._mongoClientPromise = p
  }
  return globalWithMongo._mongoClientPromise
}

const lazyClientPromise = {
  then<T1 = MongoClient, T2 = never>(
    onFulfilled?: ((value: MongoClient) => T1 | PromiseLike<T1>) | null,
    onRejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
  ) {
    return getMongoClient().then(onFulfilled, onRejected)
  },
  catch<T = never>(onRejected?: ((reason: unknown) => T | PromiseLike<T>) | null) {
    return getMongoClient().catch(onRejected)
  },
  finally(onFinally?: (() => void) | null) {
    return getMongoClient().finally(onFinally)
  },
  [Symbol.toStringTag]: 'Promise',
} as unknown as Promise<MongoClient>

export default lazyClientPromise
