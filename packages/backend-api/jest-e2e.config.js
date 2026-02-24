module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.e2e.spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@vederi/shared$': '<rootDir>/../shared/dist',
    '^@vederi/shared/(.*)$': '<rootDir>/../shared/dist/$1',
  },
};
