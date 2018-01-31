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

  async _handleMessage (msg, sender, sendResponse) {
    window.msg = msg
    if (msg.receiver && sender.tab.highlighted) {
      await this._setStream(msg.receiver, sender.tab)
      sendResponse(true)
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

  async _getCurrentTab () {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ currentWindow: true, highlighted: true }, tabs => {
        if (!tabs.length) return reject(new Error('no tab is active'))
        resolve(tabs[0])
      })
    })
  }
}

const background = new Background()
background.connect()
