# Minute
> Support content creators with ILP

- [Quick Start](#quick-start)
- [Enable your Site](#enable-your-site)

## Quick Start

Before you use this module, install and run [Moneyd](https://github.com/sharafian/moneyd).
Make sure you start moneyd with the `--unsafe-allow-extensions` flag, which will permit this
chrome extension to access the local port.

```sh
git clone https://github.com/sharafian/minute.git
cd minute
npm install
npm run build
```

Now go to `chrome://extensions`, select "Load unpacked extension", and nagivate
to the folder where you cloned this repository.

## Enable your Site

Add the following tag to your site's body:

```html
<script>
  if (window.monetize) {
    monetize({
      receiver: /* Put your SPSP payment pointer here */
    }).then(() => {
      // Make sure to thank the user!
    })
  }
</script>
```

Now any user who navigates to your site and has Minute (or another extension
that enables Web Monetization) enabled will stream payments to you. Thanking
your supporters and offering them a premium experience will incentivise them to
come back.
