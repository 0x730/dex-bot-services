const path = require('path');

module.exports = {
  apps: [
    {
      name: 'uni-v2',
      script: path.resolve(__dirname, 'src', 'uni-v2.js'),
      cwd: path.resolve(__dirname),
      autorestart: true,
      watch: false,
    },
    {
      name: 'uni-v3',
      script: path.resolve(__dirname, 'src', 'uni-v3.js'),
      cwd: path.resolve(__dirname),
      autorestart: true,
      watch: false,
    },
    /*{
      name: 'uni-v4',
      script: path.resolve(__dirname, 'src', 'uni-v4.js'),
      cwd: path.resolve(__dirname),
      env: {
        NODE_OPTIONS: `--require ${path.resolve(__dirname, 'ethers-compat.js')}`
      },
      autorestart: true,
      watch: false
    },*/
    {
      name: 'pancake',
      script: path.resolve(__dirname, 'src', 'pancake.js'),
      cwd: path.resolve(__dirname),
      autorestart: true,
      watch: false,
    },
    {
      name: 'pancake-v3',
      script: path.resolve(__dirname, 'src', 'pancake-v3.js'),
      cwd: path.resolve(__dirname),
      autorestart: true,
      watch: false,
    },
  ],
};
