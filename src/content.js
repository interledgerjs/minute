const uuid = require('uuid/v4')
const paymentPointerSelector = 'meta[name=\'webmonetization:paymentpointer\']'

function getWebMonetizationDetails () {
  const paymentPointerElement = document.head
    .querySelector(paymentPointerSelector)

  if (!paymentPointerElement) {
    return
  }

  // TODO: validate payment pointer by regex
  const paymentPointer = paymentPointerElement.getAttribute('content')
  return {
    paymentPointer
  }
}

document.addEventListener('readystatechange', ev => {
  if (event.target.readyState === 'interactive') {
    const details = getWebMonetizationDetails()

    // return if there are no web monetization tags
    if (!details) {
      return
    }

    const correlationId = uuid()

    // Indicate that meta tags have been processed and payment will be
    // attempted
    document.dispatchEvent(new CustomEvent('webmonetizationload', {
      detail: Object.assign({
        correlationId
      }, details)
    }))

    const request = Object.assign({
      command: 'pay',
      correlationId
    }, details)

    chrome.runtime.sendMessage(request, result => {
      if (result.error) {
        console.error(result.error)
        return
      }

      // Indicate that payment has started.
      // First nonzero packet has been fulfilled
      document.dispatchEvent(new CustomEvent('webmonetizationstart', {
        detail: Object.assign({
          correlationId
        }, details)
      }))
    })
  }
})
