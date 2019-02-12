const EventEmitter = require('events')
const Stream = require('./stream')

class Streams extends EventEmitter {
  constructor () {
    super()
    this._streams = {}
  }

  beginStream (id, {
    paymentPointer
  }) {
    this._streams[id] = new Stream({
      id,
      paymentPointer
    })

    this._streams[id].on('money', details => {
      console.log('STREAMS GOT MONEY EVENT, EMITTING MONEY')
      this.emit('money', Object.assign({ id }, details))
    })
    this._streams[id].start()
  }

  pauseStream (id) {
    if (this._streams[id]) {
      this._streams[id].stop()
    }
  }

  resumeStream (id) {
    if (this._streams[id]) {
      this._streams[id].start()
    }
  }

  closeStream (id) {
    if (this._streams[id]) {
      this._streams[id].stop()
      this._streams[id].removeAllListeners()
      delete this._streams[id]
    }
  }
}

module.exports = Streams
