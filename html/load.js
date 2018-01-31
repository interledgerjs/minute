window.onload = function () {
  const doc = chrome.extension.getBackgroundPage().location.href

  const iframe = document.createElement('iframe')
  iframe.src = doc

  document.getElementById('content').appendChild(iframe)
}
