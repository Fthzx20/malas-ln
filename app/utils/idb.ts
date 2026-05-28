export async function idbGet(dbName: string, storeName: string, key: string) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const getReq = store.get(key)
      getReq.onsuccess = () => resolve(getReq.result)
      getReq.onerror = () => reject(getReq.error)
    }
    req.onupgradeneeded = (ev: any) => {
      const db = ev.target.result
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName)
    }
  })
}

export async function idbSet(dbName: string, storeName: string, key: string, value: any) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const putReq = store.put(value, key)
      putReq.onsuccess = () => resolve(putReq.result)
      putReq.onerror = () => reject(putReq.error)
    }
    req.onupgradeneeded = (ev: any) => {
      const db = ev.target.result
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName)
    }
  })
}
