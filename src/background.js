const crypto = require('crypto')
const PluginBtp = require('ilp-plugin-btp')
const PluginMux = require('ilp-plugin-multiplex')
const IlpStream = require('ilp-protocol-stream')

function getBtpSecret () {
  return crypto.randomBytes(16).toString('hex')
}

class Background {
  constructor () {
  }

  async connect () {
    this._pluginBtp = new PluginBtp({
      server: 'btp+ws://localhost:7768',
      btpToken: getBtpSecret()
    })

    this._pluginMux = new PluginMux({
      throughput: '100',
      maxPacketAmount: '100'
    })

    this._pluginMux.registerDataHandler(data => {
      return this._pluginBtp.sendData(data)
    })

    this._pluginBtp.registerDataHandler(data => {
      return this._pluginMux.sendData(data)
    })

    console.log('connecting plugin btp')
    await this._pluginBtp.connect()

    console.log('connecting multiplex plugin')
    await this._pluginMux.connect()

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('received message. request=', request)
      this._handleMessage(request, sender, sendResponse)
      return true
    })

    // TODO: make this work again
    // chrome.tabs.onRemoved.addListener(tabId => {
    //   this._receivers.delete(tabId)
    // })
  }

  async _handleMessage (request, sender, sendResponse) {
    if (request.command === 'pay') {
      sendResponse(await this._startStream(request, sender.tab))
    } else if (request.command === 'stats') {
      sendResponse(await this._getStats())
    } else {
      sendResponse({ error: 'invalid command' })
    }
  }

  _spspReceiverToUrl (receiver) {
    return receiver.startsWith('$')
      ? 'https://' + receiver.substring(1)
      : receiver
  }

  async _spspQuery (receiver, correlationId) {
    const url = this._spspReceiverToUrl(receiver)
    const result = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      headers: {
        Accept: 'application/spsp4+json',
        'Web-Monetization-Id': correlationId
      }
    })

    if (!result.ok) {
      throw new Error('Error in SPSP query.' +
        ' receiver=' + receiver +
        ' correlationId=' + correlationId +
        ' message=' + result.statusText)
    }

    return result.json()
  }

  async _startStream ({ paymentPointer, correlationId }, tab) {
    console.log('querying', paymentPointer)
    const query = await this._spspQuery(paymentPointer)
    console.log('got query result', query)
    console.log('tab url:', tab.url)

    console.log('creating plugin')
    const plugin = this._pluginMux.getChild({
      id: String(Math.random()).substring(2)
    })

    console.log('creating STREAM connection')
    console.log('shared secret', Buffer.from(query.shared_secret, 'base64'))
    const connection = await IlpStream.createConnection({
      destinationAccount: query.destination_account,
      sharedSecret: Buffer.from(query.shared_secret, 'base64'),
      plugin
    })

    // TODO: better way to send infinity
    console.log('sending money')
    const stream = connection.createStream()
    stream.setSendMax('999999')
    stream.on('outgoing_money', amount => {
      console.log('sent packet.',
        'paymentPointer=' + paymentPointer,
        'amount=' + amount)
    })
  }

  async _getStats () {
    return {}
  }
}

window.background = new Background()
window.background.connect()
