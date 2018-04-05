const EventEmitter = require('events')
window._crypto = null

class Url {
  constructor (href) {
    this.parsed = new URL(href.replace(/^.+?:/, 'http:'))

    this.protocol = href.match(/(^.+?:)/)[1]
    this.pathname = this.parsed.pathname
    this.username = this.parsed.username
    this.password = this.parsed.password
    this.host = this.parsed.host
  }

  get href() {
    return this.protocol + '//' + this.host + this.pathname
  }

  toString() {
    return this.href
  }
}

window.SourceMapPolyfill = { install: (() => {}) }
window.FetchPolyfill = fetch
window.UrlPolyfill = { URL: Url }
window.WsPolyfill = class WsPolyfill extends EventEmitter {
  constructor (uri) {
    super()

    this._ws = new WebSocket(uri)
    this._ws.binaryType = 'arraybuffer'
    this._ws.onerror = this.emit.bind(this, 'error')
    this._ws.onopen = this.emit.bind(this, 'open')
    this._ws.onclose = this.emit.bind(this, 'close')
    this._ws.onmessage = (msg) => {
      console.log('WS MESSAGE', msg.data)
      this.emit('message', Buffer.from(msg.data))
    }
  }

  send (msg, cb) {
    console.log(msg.toString('hex'))
    const arrayBuffer = new Uint8Array(msg).buffer
    this._ws.send(arrayBuffer)
    cb()
  }
}
