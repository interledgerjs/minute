const uuid = require('uuid')

class Monetization {
  static async setReceiver ({ receiver }) {
    const id = uuid()
    const response = new Promise((resolve, reject) => {
      function responseListener (ev) {
        const msg = ev.detail
        if (msg.id !== id) return
        setImmediate(() => document.removeEventListener('ilp_pay_response', responseListener))
        console.log('got message:', msg)
        resolve(msg.result)
      }
      document.addEventListener('ilp_pay_response', responseListener)
    })

    document.dispatchEvent(new CustomEvent('ilp_pay_request', { detail: { id, receiver } }))
    return response
  }
}

class ILP {
  static async pay ({ receiver }) {
    console.error('ILP.pay is deprecated! Switch to Monetization.setReceiver')
    return Monetization.setReceiver({ receiver })
  }
}

window.Monetization = Monetization
window.ILP = ILP
