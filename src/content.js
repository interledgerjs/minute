const uuid = require('uuid/v4')
const paymentPointerSelector = 'meta[name=\'monetization\']'

if (window === window.top) {
  chrome.runtime.sendMessage({
    command: 'stopWebMonetization'
  })
}

function inject (code) {
  const script = document.createElement('script')
  script.innerHTML = code
  document.documentElement.appendChild(script)

  // clean it up afterwards
  document.documentElement.removeChild(script)
}

function getWebMonetizationDetails () {
  const paymentPointerElement = document.head
    .querySelector(paymentPointerSelector)

  if (!paymentPointerElement) {
    return
  }

  const paymentPointer = paymentPointerElement.getAttribute('content')
  return {
    paymentPointer
  }
}

function startMonetization () {
  const details = getWebMonetizationDetails()

  // return if there are no web monetization tags
  if (!details) {
    return
  }

  // if the page is an iframe make sure it's authorized
  if (window !== window.top) {
    console.error('This page is not authorized to use Web Monetization.')
    return
  }

  const id = uuid()
  const request = {
    command: 'startWebMonetization',
    data: Object.assign({ id }, details)
  }

  chrome.runtime.sendMessage(request, result => {
    if (result.error) {
      console.error('web monetization error.', result.error)
      return
    }

    if (document.visibilityState === 'hidden') {
      console.log('visibility is hidden')
      chrome.runtime.sendMessage({
        command: 'pauseWebMonetization',
        data: { id }
      })
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        chrome.runtime.sendMessage({
          command: 'resumeWebMonetization',
          data: { id }
        })
      } else {
        chrome.runtime.sendMessage({
          command: 'pauseWebMonetization',
          data: { id }
        })
      }
    })

    let started = false
    chrome.runtime.onMessage.addListener((request, sender) => {
      if (request.command === 'monetizationProgress') {
        console.log('GOT MONETIZATIONPROGRESS MESSAGE')
        if (!started) {
          started = true

          inject(`document.monetization.state = 'started'`)
          window.postMessage({
            webMonetization: true,
            name: 'monetizationstart',
            detail: Object.assign({ requestId: id }, details)
          })
        }

        chrome.runtime.sendMessage({
          command: 'handleMonetizedSite',
          data: {
            packet: {
              amount: request.data.sentAmount
            }
          }
        })

        window.postMessage({
          webMonetization: true,
          name: 'monetizationprogress',
          detail: {
            amount: request.data.amount,
            assetCode: request.data.assetCode,
            assetScale: request.data.assetScale
          }
        })
      }
    })

    // Indicate that payment has started.
    // First nonzero packet has been fulfilled
  })
}

// Scan for WM meta tags when page is interactive
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  startMonetization()
} else {
  document.addEventListener('readystatechange', async event => {
    if (event.target.readyState === 'interactive') {
      startMonetization()
    }
  })
}

// Adapter from posted messages on window to `CustomEvent`s
// TODO: less janky cross-platform way to create a generic EventTarget
inject(`
  document.monetization = document.createElement('div')
  document.monetization.state = 'pending'
  window.addEventListener('message', function (event) {
    if (event.source === window && event.data.webMonetization) {
      document.monetization.dispatchEvent(
        new CustomEvent(event.data.name, {
          detail: event.data.detail
        }))
    }
  })
`)

// bind the events and inject the code required for the previous version of web
// monetization
// require('./legacyContent')
