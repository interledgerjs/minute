const Streams = require('./services/streams')

class Background {
  constructor () {
    this.streams = new Streams()
    this.tabsToStreams = {}
    this.streamsToTabs = {}
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

  async _incrementSite (url, amount) {
    const host = new URL(url).host
    const entry = await this._idbQuery(this._db.transaction('sites').objectStore('sites').get(host)) || { amount: 0 }
    console.log('TYPEOF ENTRY_AMOUNT=', typeof entry.amount, 'TYPEOF AMOUNT=', typeof amount)
    const newAmount = Number(entry.amount) + Number(amount)
    console.log('setting new balance. host=' + host, 'paid=' + entry.amount, 'new=' + newAmount)
    return this._idbQuery(this._db.transaction(['sites'], 'readwrite').objectStore('sites').put({ host, amount: newAmount }))
  }

  async handleMonetizedSite (sender, packet) {
    console.log('GOT HANDLEMONETIZEDSITE MESSAGE, PACKET=', packet)
    const url = sender.url
    const { amount } = packet
    await this._incrementSite(url, amount)
  }

  async startWebMonetization (request, sender) {
    const { paymentPointer, id } = request.data
    const tab = sender.tab.id

    console.log('starting stream', id)
    this.tabsToStreams[tab] = id
    this.streamsToTabs[id] = tab
    this.streams.beginStream(id, {
      paymentPointer
    })

    return true
  }

  pauseWebMonetization (request) {
    console.log('pausing stream', request.data.id)
    this.streams.pauseStream(request.data.id)
    return true
  }

  resumeWebMonetization (request) {
    console.log('resuming stream', request.data.id)
    this.streams.resumeStream(request.data.id)
    return true
  }

  stopWebMonetization (sender) {
    this._closeStream(sender.tab.id)
    return true
  }

  _closeStream (tabId) {
    console.log('closing stream with id', this.tabsToStreams[tabId])
    this.streams.closeStream(this.tabsToStreams[tabId])
    delete this.streamsToTabs[this.tabsToStreams[tabId]]
    delete this.tabsToStreams[tabId]
  }

  async run () {
    console.log('connecting indexeddb for stats')
    this._db = await this._idbQuery(indexedDB.open('MinuteDatabase', 2))

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('received message. request=', request)
      this._handleMessage(request, sender, sendResponse)
      return true
    })

    chrome.tabs.onRemoved.addListener(tabId => {
      console.log('removing tab with id', tabId)
      this._closeStream(tabId)
    })

    // pass stream monetization events to the correct tab
    this.streams.on('money', details => {
      console.log('A STREAM GOT MONEY, DETAILS=', details)
      console.log('sending money message.', this.streamsToTabs[details.id], details)
      chrome.tabs.sendMessage(this.streamsToTabs[details.id], {
        command: 'monetizationProgress',
        data: details
      })
    })
  }

  // async connect () {
  //   console.log('connecting plugin')
  //   await this._plugin.connect()
  //   console.log('connected plugin')

  //   // TODO: need to handle anything during connect phase?
  //   chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  //     console.log('received message. request=', request)
  //     this._handleMessage(request, sender, sendResponse)
  //     return true
  //   })

  //   console.log('registered listener')
  //   setImmediate(async () => {
  //     while (true) {
  //       try {
  //         const tab = await this._getCurrentTab()
  //         const receiver = this._receivers.get(tab.id)

  //         if (receiver && tab.url === receiver.url) {
  //           console.log('sending single chunk payment')
  //           await PSK2.sendSingleChunk(this._plugin, Object.assign({
  //             sourceAmount: this._chunkAmount,
  //             id: receiver.paymentId,
  //             sequence: receiver.sequence++
  //           }, receiver.query))

  //           await this._incrementSite(receiver.url)
  //         } else {
  //           this._receivers.delete(tab.id)
  //         }
  //       } catch (e) {
  //         if (e.message !== 'no tab is active') {
  //           console.log('sending error. error=', e)
  //         }
  //       }

  //       await new Promise(resolve => setTimeout(resolve, this._interval))
  //     }
  //   })

  //   chrome.tabs.onRemoved.addListener(tabId => {
  //     this._receivers.delete(tabId)
  //   })
  // }

  async _handleMessage (request, sender, sendResponse) {
    if (request.command === 'startWebMonetization') {
      console.log('got startwebmonetization')
      sendResponse(await this.startWebMonetization(request, sender))
    } else if (request.command === 'pauseWebMonetization') {
      sendResponse(await this.pauseWebMonetization(request))
    } else if (request.command === 'resumeWebMonetization') {
      sendResponse(await this.resumeWebMonetization(request))
    } else if (request.command === 'stopWebMonetization') {
      sendResponse(await this.stopWebMonetization(sender))
    } else if (request.command === 'stats') {
      sendResponse(await this._getStats())
    } else if (request.command === 'handleMonetizedSite') {
      sendResponse(await this.handleMonetizedSite(sender, request.data.packet))
    }
  }

  // async _setStream (receiver, tab) {
  //   this._receivers.delete(tab.id)
  //   if (!receiver) {
  //     console.log('removing receiver for', tab.id)
  //     return
  //   }

  //   console.log('querying', receiver)
  //   const query = await SPSP.query(receiver)
  //   console.log('got query result', query)
  //   console.log('tab url:', tab.url)
  //   this._receivers.set(tab.id, {
  //     url: tab.url,
  //     query,
  //     sequence: 1,
  //     paymentId: crypto.randomBytes(16),
  //     receiver
  //   })
  // }

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

  // async _getCurrentTab () {
  //   return new Promise((resolve, reject) => {
  //     chrome.tabs.query({ currentWindow: true, highlighted: true }, tabs => {
  //       if (!tabs.length) return reject(new Error('no tab is active'))
  //       resolve(tabs[0])
  //     })
  //   })
  // }
}

window.background = new Background()
window.background.run()
