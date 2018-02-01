const crypto = require('crypto')
const PluginBtp = require('ilp-plugin-btp')
const SPSP = require('ilp-protocol-spsp')
const PSK2 = require('ilp-protocol-psk2')

class Background {
  constructor () {
    this._secret = crypto.randomBytes(16).toString('hex')
    console.log('secret: ' + this._secret)
    this._server = 'btp+ws://:' + this._secret + '@localhost:7768'
    console.log('server: ' + this._server)
    this._plugin = new PluginBtp({ server: this._server })

    this._receivers = new Map()
    this._chunkAmount = 25
    this._interval = 500
  }

  async _idbQuery (request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = event => resolve(request.result)
      request.oncomplete = event => resolve(request.result)
      request.onerror = event =>
        reject(new Error('IndexedDB Error: ' + request.errorCode))
      request.onupgradeneeded = event => {
        const store = event.target.result.createObjectStore('sites', { keyPath: 'host' })
        store.createIndex('amount', 'amount', { unique: false })
      }
    })
  }

  async _incrementSite (url) {
    const host = new URL(url).host
    const entry = await this._idbQuery(this._db.transaction('sites').objectStore('sites').get(host)) || { amount: 0 }
    const newAmount = Number(entry.amount) + this._chunkAmount
    console.log('setting new balance. host=' + host, 'paid=' + entry.amount, 'new=' + newAmount)
    return this._idbQuery(this._db.transaction(['sites'], 'readwrite').objectStore('sites').put({ host, amount: newAmount }))
  }

  async connect () {
    console.log('connecting plugin')
    await this._plugin.connect()
    console.log('connected plugin')

    // TODO: need to handle anything during connect phase?
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('received message. request=', request)
      this._handleMessage(request, sender, sendResponse)
      return true
    })

    console.log('connecting indexeddb for stats')
    this._db = await this._idbQuery(indexedDB.open('MinuteDatabase', 2))

    console.log('registered listener')
    setImmediate(async () => {
      while (true) {
        try {
          const tab = await this._getCurrentTab()
          const receiver = this._receivers.get(tab.id)

          if (receiver && tab.url === receiver.url) {
            console.log('sending single chunk payment')
            await PSK2.sendSingleChunk(this._plugin, Object.assign({
              sourceAmount: this._chunkAmount,
              id: receiver.paymentId,
              sequence: receiver.sequence++
            }, receiver.query))

            await this._incrementSite(receiver.url)
          } else {
            this._receivers.delete(tab.id)
          }
        } catch (e) {
          if (e.message !== 'no tab is active') {
            console.log('sending error. error=', e) 
          }
        }

        await new Promise(resolve => setTimeout(resolve, this._interval))
      }
    })

    chrome.tabs.onRemoved.addListener(tabId => {
      this._receivers.delete(tabId)
    })
  }

  async _handleMessage (request, sender, sendResponse) {
    if (request.command === 'pay' && request.msg.receiver && sender.tab.highlighted) {
      await this._setStream(request.msg.receiver, sender.tab)
      sendResponse(true)
    } else if (request.command === 'stats') {
      sendResponse(await this._getStats())
    } else {
      sendResponse(false)
    }
  }

  async _setStream (receiver, tab) {
    this._receivers.delete(tab.id)
    console.log('querying', receiver)
    const query = await SPSP.query(receiver)
    console.log('got query result', query)
    console.log('tab url:', tab.url)
    this._receivers.set(tab.id, {
      url: tab.url,
      query,
      sequence: 1,
      paymentId: crypto.randomBytes(16),
      receiver
    })
  }

  async _getStats () {
    const ret = {
      sites: []
    }

    let entries = 6
    await new Promise(resolve => {
      this._db.transaction('sites').objectStore('sites').index('amount').openCursor(IDBKeyRange.lowerBound(0), 'prev').onsuccess = event => {
        const cursor = event.target.result
        if (entries-- && cursor) {
          ret.sites.push(cursor.value)
          cursor.continue()
        } else {
          resolve()
        }
      }
    })

    return ret
  }

  async _getCurrentTab () {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ currentWindow: true, highlighted: true }, tabs => {
        if (!tabs.length) return reject(new Error('no tab is active'))
        resolve(tabs[0])
      })
    })
  }
}

window.background = new Background()
window.background.connect()
