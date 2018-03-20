import "bootstrap/dist/js/bootstrap.js"
import "bootstrap/dist/css/bootstrap.css"

async function loadData () {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ command: 'stats' }, result => {
      console.log('RESULT:', result)
      resolve(result)
    })
  })
}

async function refresh () {
  const { sites } = await loadData()
  const statsTable = document.getElementById('site_stats_body')
  const entries = 6

  for (let i = 0; i < entries; ++i) {
    const site = sites[i] || { host: '&nbsp;', amount: '&nbsp;' }
    const [ host, amount ] = statsTable
      .querySelectorAll('tr')[i]
      .querySelectorAll('td, th')

    host.innerHTML = site.host

    if (!Number(site.amount)) {
      amount.innerHTML = site.amount
      continue
    }

    if (!Number(amount.innerHTML)) {
      amount.innerHTML = (site.amount / 1e6).toFixed(6)
      continue
    }

    let currentAmount = Math.floor((Number(amount.innerHTML) || 0) * 1e6)
    let targetAmount = Number(site.amount)
    const animateInterval = setInterval(() => {
      currentAmount += Math.sign(targetAmount - currentAmount)
      amount.innerHTML = (currentAmount / 1e6).toFixed(6)
      if (currentAmount === targetAmount) {
        clearInterval(animateInterval)
      }
    }, 10)
  }
}

refresh()
  .then(() => {
    console.log('data loaded')
  })

setInterval(refresh, 500)
