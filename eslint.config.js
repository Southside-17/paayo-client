const expo = require('eslint-config-expo/flat');

module.exports = [
    ...expo,
    {
        ignores: ['android/', 'ios/', 'node_modules/', '.expo/', 'src/theme/colors.js'],
    },
    {
        files: ['jest.setup.js', '**/__tests__/**'],
        languageOptions: {
            globals: {
                jest: 'readonly',
                describe: 'readonly',
                it: 'readonly',
                expect: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                global: 'writable',
            },
        },
    },
];
