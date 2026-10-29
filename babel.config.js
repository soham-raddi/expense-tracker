module.exports = {
  presets: ['module:@react-native/babel-preset'],
  env: {
    // Release bundles have every console.* call removed so nothing can leak into device logs.
    production: {
      plugins: ['transform-remove-console'],
    },
  },
};
