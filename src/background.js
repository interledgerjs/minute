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
    this._chunkAmount = 250
    this._interval = 5000
    this._query = null
    this._sequence = 1
    this._paymentId = null
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
        if (this._query) {
          try {
            await PSK2.sendSingleChunk(this._plugin, Object.assign({
              sourceAmount: this._chunkAmount,
              id: this._paymentId,
              sequence: this._sequence++
            }, this._query))
          } catch (e) {
            console.log('sending error. error=', e) 
          }
        }

        await new Promise(resolve => setTimeout(resolve, this._interval))
      }
    })
  }

  async _handleMessage (msg, sender, sendResponse) {
    window.msg = msg
    if (msg.receiver) {
      await this._setStream(msg.receiver)
      sendResponse(true)
    } else {
      sendResponse(false)
    }
  }

  async _setStream (receiver) {
    this._query = null
    this._paymentId = crypto.randomBytes(16)
    this._sequence = 1
    this._query = await SPSP.query(receiver)
  }
}

const background = new Background()
background.connect()
