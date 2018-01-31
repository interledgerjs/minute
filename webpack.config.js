'use strict'

module.exports = {
  entry: {
    'dist/websocket': './src/polyfill/websocket.js',
    'dist/background': './src/background.js',
    'dist/content': './src/content.js',
    'dist/inject': './src/inject.js'
  },

  output: {
    filename: '[name].js',
    path: __dirname,
    libraryTarget: 'umd'
  },

  externals: {
    'ws': 'WsPolyfill',
    'url': 'UrlPolyfill',
    'node-fetch': 'FetchPolyfill'
  },

  module: {
    noParse: [ /\bws$/ ],
    loaders: [
      {
        test: /\.js$/,
        // exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          presets: ['es2017', 'es2015', 'react'],
          plugins: [['transform-runtime', {
            helpers: false,
            polyfill: false,
            regenerator: true, }]
          ]
        }
      },
      { test: /ed25519/, loader: 'null' },
      { test: /\.json$/, loader: 'json-loader' }
    ]
  },

  node: {
    console: true,
    fs: 'empty',
    net: 'empty',
    tls: 'empty'
  }
}
