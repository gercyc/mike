/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const Dotenv = require("dotenv-webpack");

module.exports = async (_env, options) => {
  const isDev = options.mode !== "production";

  let httpsOptions = true; // webpack-dev-server built-in self-signed fallback
  if (isDev) {
    try {
      const devCerts = require("office-addin-dev-certs");
      httpsOptions = await devCerts.getHttpsServerOptions();
    } catch {
      console.warn(
        "[mike-addin] office-addin-dev-certs not installed or certs missing.",
        "Run `npm run install-certs` once, then restart the dev server.",
      );
    }
  }

  return {
    entry: {
      taskpane: "./src/taskpane/index.tsx",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].bundle.js",
      clean: true,
      // Relative paths so the bundle works whether served at /, /addin/,
      // or any other mount point (the Electron shell mounts it at
      // https://127.0.0.1:3002/addin/).
      publicPath: "",
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js", ".jsx"],
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx|js|jsx)$/,
          use: "babel-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader", "postcss-loader"],
        },
        {
          test: /\.(png|jpg|jpeg|gif|svg|ico)$/,
          type: "asset/resource",
          generator: { filename: "assets/[name][ext]" },
        },
      ],
    },
    plugins: [
      new Dotenv({ path: "./.env", safe: false, silent: true }),
      new HtmlWebpackPlugin({
        filename: "taskpane.html",
        template: "./src/taskpane/index.html",
        chunks: ["taskpane"],
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: "manifest.xml", to: "manifest.xml" },
          { from: "assets", to: "assets", noErrorOnMissing: true },
        ],
      }),
    ],
    devServer: {
      port: 3002,
      server: { type: "https", options: httpsOptions },
      static: { directory: path.join(__dirname, "dist") },
      headers: { "Access-Control-Allow-Origin": "*" },
      hot: true,
      compress: true,
    },
    devtool: isDev ? "source-map" : false,
    mode: options.mode,
  };
};
