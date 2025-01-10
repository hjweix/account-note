const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    content: ['./src/content.js', './src/styles.css'],
    popup: ['./src/popup.js', './src/popup.css'],
    management: ['./src/management.js', './src/management.css']
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: {
            comments: false,
          },
          compress: {
            drop_console: true, // 移除 console
            drop_debugger: true // 移除 debugger
          }
        },
        extractComments: false
      }),
    ],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader'
        ]
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].css'
    }),
    new CopyPlugin({
      patterns: [
        { 
          from: "manifest.json",
          transform(content) {
            // 修改 manifest.json 中的路径
            const manifest = JSON.parse(content);
            manifest.content_scripts[0].js = ['content.js'];
            manifest.content_scripts[0].css = ['content.css'];
            return JSON.stringify(manifest, null, 2);
          }
        },
        { from: "icons", to: "icons" },
        { from: "*.html" },
        { from: "_locales", to: "_locales" }
      ],
    }),
  ]
}; 