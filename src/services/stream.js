const fetch = require('node-fetch')
const crypto = require('crypto')

const EventEmitter = require('events')
const IlpStream = require('ilp-protocol-stream')
const IlpPluginBtp = require('ilp-plugin-btp')
const paymentPointerToUrl = p => p.startsWith('$')
  ? 'https://' + p.substring(1)
  : p

class Stream extends EventEmitter {
  constructor ({
    id,
    paymentPointer
  }) {
    super()

    this._id = id
    this._spspUrl = paymentPointerToUrl(paymentPointer)
    this._debug = (...args) => console.log('minute:stream:' + this._id, ...args)
    this._active = false
    this._lastDelivered = 0

    this._secret = crypto.randomBytes(16).toString('hex')
    this._server = 'btp+ws://:' + this._secret + '@localhost:7768'
  }

  async start () {
    if (!this._active) {
      this._active = true
      while (this._active) {
        try {
          await this._stream()
        } catch (e) {
          this._debug('error streaming. retry in 2s. err=', e.message)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      this._debug('aborted because stream is no longer active.')
    }
  }

  async _getPlugin () {
    if (!this._active) throw new Error('aborted monetization')

    this._plugin = new IlpPluginBtp({
      server: this._server
    })

    this._debug('connecting ilp plugin. server=', this._server)
    await this._plugin.connect()

    return this._plugin
  }

  async _getSPSPDetails () {
    this._debug('fetching spsp details. url=', this._spspUrl)
    const spspRes = await fetch(this._spspUrl, {
      credentials: 'omit',
      cache: 'no-cache',
      headers: {
        Accept: 'application/spsp4+json',
        'Web-Monetization-Id': this._id
      }
    })

    if (!spspRes.ok) {
      this._debug('failed to fetch spsp. status=' + spspRes.status)
      throw new Error('failed to fetch spsp')
    }

    if (!this._active) throw new Error('aborted monetization')

    const spspDetails = await spspRes.json()
    return spspDetails
  }

  async _stream () {
    const [ plugin, spspDetails ] = await Promise.all([
      this._getPlugin(),
      this._getSPSPDetails()
    ])

    if (!this._active) return

    this._debug('creating ilp/stream connection.')
    this._connection = await IlpStream.createConnection({
      plugin,
      destinationAccount: spspDetails.destination_account,
      sharedSecret: Buffer.from(spspDetails.shared_secret, 'base64')
    })

    if (!this._active) return

    // send practically forever at allowed bandwidth
    this._debug('attempting to send on connection.')
    this._ilpStream = this._connection.createStream()
    this._ilpStream.setSendMax(2 ** 55)
    this._lastDelivered = 0

    return new Promise((resolve, reject) => {
      const onMoney = sentAmount => {
        console.log('got some outgoing money')
        const delivered = Number(this._connection._totalDelivered)
        const amount = delivered - this._lastDelivered
        console.log('delivered', delivered, 'lastDelivered', this._lastDelivered)
        this._lastDelivered = delivered

        if (amount > 0) {
          console.log('emitting money. amount=' + amount)
          this.emit('money', {
            amount: String(amount),
            sentAmount: sentAmount,
            assetCode: this._connection.destinationAssetCode,
            assetScale: this._connection.destinationAssetScale
          })
        }
      }

      this._ilpStream.on('outgoing_money', onMoney)
      this._connection.once('close', () => {
        this._connection.removeListener('outgoing_money')
      })
    })
  }

  async stop () {
    this._active = false
    if (this._connection) {
      this._debug('severing ilp/stream connection')
      this._debug('destroying ilpStream')
      this._ilpStream.destroy()
      this._debug('destroying connection')
      this._connection.destroy()
      return this._plugin.disconnect()
    }
  }
}

module.exports = Stream
