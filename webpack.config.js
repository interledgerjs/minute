'use strict'
const webpack = require('webpack')

module.exports = {
  entry: {
    'dist/websocket': './src/polyfill/websocket.js',
    'dist/background': './src/background.js',
    'dist/content': './src/content.js',
    'dist/inject': './src/inject.js',
    'dist/popup': './src/popup.js'
  },

  output: {
    filename: '[name].js',
    path: __dirname,
    libraryTarget: 'umd'
  },

  externals: {
    'ws': 'WsPolyfill',
    'url': 'UrlPolyfill',
    'node-fetch': 'FetchPolyfill',
    'source-map-support': 'SourceMapPolyfill'
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
      {
        test: /\.css$/,
        loaders: ["style-loader", "css-loader"]
      },
      { test: /ed25519/, loader: 'null' },
      { test: /\.json$/, loader: 'json-loader' },
      {
        test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        loader: "url-loader?limit=10000&mimetype=application/font-woff&name=fonts/[name].[ext]"
      },{
        test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        loader: "file-loader?name=fonts/[name].[ext]"
      },{
        test: /\.(jpe?g|png|gif)$/,
        loader:'file-loader?name=img/[name].[ext]'
      }
    ]
  },

  plugins: [
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
    })
  ],

  node: {
    console: true,
    fs: 'empty',
    net: 'empty',
    tls: 'empty'
  }
}
