/** Minimal in-memory stand-in for the Mongo Db API used by coin/payment code (tests only). */
type Doc = Record<string, any>

function matches(doc: Doc, filter: Doc): boolean {
  return Object.entries(filter).every(([k, v]) => {
    if (v && typeof v === 'object' && '$ne' in v) return doc[k] !== v.$ne
    return doc[k] === v
  })
}

function applyUpdate(doc: Doc, update: Doc, inserting: boolean) {
  for (const [k, v] of Object.entries(update.$set || {})) doc[k] = v
  for (const [k, v] of Object.entries(update.$inc || {})) doc[k] = (doc[k] || 0) + (v as number)
  if (inserting) for (const [k, v] of Object.entries(update.$setOnInsert || {})) doc[k] = v
}

class FakeCollection {
  docs: Doc[] = []
  async findOne(filter: Doc) {
    return this.docs.find((d) => matches(d, filter)) ?? null
  }
  async insertOne(doc: Doc) {
    if (doc._id !== undefined && this.docs.some((d) => d._id === doc._id)) {
      throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 })
    }
    this.docs.push({ ...doc })
    return { acknowledged: true }
  }
  async updateOne(filter: Doc, update: Doc, opts?: { upsert?: boolean }) {
    const d = this.docs.find((x) => matches(x, filter))
    if (d) {
      applyUpdate(d, update, false)
      return { matchedCount: 1 }
    }
    if (opts?.upsert) {
      const nd: Doc = {}
      for (const [k, v] of Object.entries(filter)) if (typeof v !== 'object') nd[k] = v
      applyUpdate(nd, update, true)
      this.docs.push(nd)
    }
    return { matchedCount: 0 }
  }
  async findOneAndUpdate(filter: Doc, update: Doc, opts?: { upsert?: boolean }) {
    const d = this.docs.find((x) => matches(x, filter))
    if (!d && opts?.upsert) {
      await this.updateOne(filter, update, { upsert: true })
      return { value: { ...this.docs[this.docs.length - 1] } }
    }
    if (!d) return { value: null }
    applyUpdate(d, update, false)
    return { value: { ...d } }
  }
}

export function createFakeDb() {
  const cols = new Map<string, FakeCollection>()
  return {
    collection(name: string) {
      if (!cols.has(name)) cols.set(name, new FakeCollection())
      return cols.get(name)!
    },
  } as any
}
