/** Jest config for the API (ts-jest). Runs *.spec.ts under src/. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: {
    '^@aiow/config$': '<rootDir>/../../packages/config/src/index.ts',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { isolatedModules: true }],
  },
};
