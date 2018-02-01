const inject = () => {
  const script = document.createElement('script') 
  script.src = chrome.extension.getURL('dist/inject.js')
  document.documentElement.appendChild(script)
}

const listen = () => {
  // const connection = chrome.runtime.connect({ name: 'ilp_rpc' })
  document.addEventListener('ilp_pay_request', ev => {
    const msg = ev.detail
    const request = { command: 'pay', msg }
    console.log('dispatching request', request)

    chrome.runtime.sendMessage(request, result => {
      document.dispatchEvent(new CustomEvent('ilp_pay_response', { detail: {
        id: msg.id,
        result
      }}))
    })
  })
}

console.log('listening')
listen()
console.log('injecting')
inject()
console.log('done')
