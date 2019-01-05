'use strict'
const webpack = require('webpack')

console.log('dirname', __dirname)

module.exports = {
  mode: 'development',

  entry: {
    'dist/websocket': './src/polyfill/websocket.js',
    'dist/background': './src/background.js',
    'dist/content': './src/content.js'
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
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: {
          presets: ['@babel/env'],
          plugins: [['@babel/plugin-transform-runtime', {
            helpers: false,
            regenerator: true, }]
          ]
        }
      }
    ]
  },

  node: {
    console: true,
    fs: 'empty',
    net: 'empty',
    tls: 'empty',
    cluster: 'empty'
  }
}
