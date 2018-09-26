module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current'
        },
        modules: 'commonjs'
      }
    ],
    '@babel/preset-react'
  ],
  plugins: [
    [
      'transform-imports',
      {
        'lodash-es': {
          // eslint-disable-next-line no-template-curly-in-string
          transform: 'lodash-es/${member}',
          preventFullImport: true
        }
      }
    ],
    ['@babel/plugin-transform-runtime'],
    '@babel/plugin-proposal-class-properties',
    ['@babel/plugin-proposal-object-rest-spread', { useBuiltIns: true }]
  ],
  env: {
    production: {
      plugins: [['emotion', { hoist: true }]]
    },
    development: {
      plugins: [['emotion', { sourceMap: true, autoLabel: true }]]
    }
  }
}
