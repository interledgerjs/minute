const crypto = require('crypto')
const PluginBtp = require('ilp-plugin-btp')
const IlpStream = require('ilp-protocol-stream')

class Background {
  constructor () {
    this._secret = crypto.randomBytes(16).toString('hex')
    this._server = 'btp+ws://:' + this._secret + '@localhost:7768'
    this._plugin = new PluginBtp({ server: this._server })

    // TODO: constrain throughput globally
    this._receivers = new Map()
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

    // TODO: make this work again
    chrome.tabs.onRemoved.addListener(tabId => {
      this._receivers.delete(tabId)
    })
  }

  async _handleMessage (request, sender, sendResponse) {
    if (request.command === 'pay') {
      sendResponse(await this._startStream(request.msg.receiver, sender.tab))
    } else if (request.command === 'stats') {
      sendResponse(await this._getStats())
    } else {
      sendResponse({ error: 'invalid command' })
    }
  }

  async _startStream (receiver, tab) {
    this._receivers.delete(tab.id)
    if (!receiver) {
      console.log('removing receiver for', tab.id)
      return
    }

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
    return {}
  }
}

window.background = new Background()
window.background.connect()
