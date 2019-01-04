const crypto = require('crypto')
const PluginBtp = require('ilp-plugin-btp')
const PluginMux = require('ilp-plugin-multiplex')
const IlpConnector = require('ilp-connector')
const Ildcp = require('ilp-protocol-ildcp')
const IlpStream = require('ilp-protocol-stream')

function getBtpSecret () {
  return crypto.randomBytes(16).toString('hex')
}

class Background {
  constructor () {
    // this._server = 'btp+ws://:' + this._secret + '@localhost:7768'

    // TODO: just add an option for connector to inherit env
  }

  async connect () {
    this._pluginBtp = new PluginBtp({
      server: 'btp+ws://localhost:7768',
      btpToken: getBtpSecret()
    })

    console.log('connecting plugin btp')
    await this._pluginBtp.connect()

    console.log('ildcp lookup on plugin btp')
    const ildcp = Ildcp.fetch(this.pluginBtp.sendData.bind(this._pluginBtp))

    this._pluginMux = new PluginMux({})

    console.log('creating connector')
    this._connector = IlpConnector.createApp({
      spread: 0,
      backend: 'one-to-one',
      store: 'ilp-store-memory',
      initialConnectTimeout: 60000,
      env: ildcp.clientAddress.startsWith('g.') ? 'production' : 'test',
      accounts: {
        wm: {
          relation: 'child',
          plugin: this._pluginMux,
          assetCode: ildcp.assetCode,
          assetScale: (ildcp.assetCode === 'XRP' ? 9 : ildcp.assetScale),
          throughput: {
            // TODO: make the throughput configurable
            outgoingAmount: '10000'
          }
        },
        moneyd: {
          relation: 'parent',
          plugin: this._pluginBtp,
          assetCode: ildcp.assetCode,
          assetScale: ildcp.assetScale,
          sendRoutes: false,
          receiveRoutes: false
        }
      }
    })

    console.log('connecting connector')
    await this._connector.listen()
    console.log('connector connected')

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
      sendResponse(await this._startStream(request.msg, sender.tab))
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

    // TODO
  }

  async _getStats () {
    return {}
  }
}

window.background = new Background()
window.background.connect()
