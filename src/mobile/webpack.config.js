const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Customize the config before returning it.
  config.devServer = {
    ...config.devServer,
    port: 3000,
    hot: true,
    compress: true,
    historyApiFallback: true,
    open: true,
  };

  return config;
};