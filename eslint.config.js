import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    files: ["**/*.rules"],
  },
  firebaseRulesPlugin.configs['flat/recommended']
];
