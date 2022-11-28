const restrictImportFolders = {
  create,
  meta: {
    type: 'problem',
    docs: {
      category: 'Static analysis',
      description:
        'Restrict which folders can import from which other folders.',
    },
    messages: {
      expectedOneRule:
        'Expected exactly 1 restrict-import-folders rule for ' +
        '{{filename}}. Got: {{matchingRules}}. ' +
        'Modify .eslintrc.js to add a policy for this directory.',
      importNotAllowed:
        '{{importingTo}} disallows importing from all packages and modules ' +
        'other than: {{allowedFolders}}. ' +
        'If this import should be allowed, you can add it in .eslintrc.js. ' +
        'Make sure to review ' +
        'https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html' +
        ' first.',
    },
  },
  schema: [
    {
      type: 'object',
      properties: {
        rules: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              importTo: {
                type: 'string',
              },
              canImportFrom: {
                type: 'array',
                items: {type: 'string'},
                uniqueItems: true,
                minLength: 0,
              },
              cannotImportFrom: {
                type: 'array',
                items: {type: 'string'},
                uniqueItems: true,
                minLength: 0,
              },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
  ],
};

module.exports = {
  rules: {
    'restrict-import-folders': restrictImportFolders,
  },
};

function create(context) {
  const {options, report} = context;
  const {rules} = options[0];
  const cwd = context.getCwd();

  // Copied this line from https://github.com/import-js/eslint-plugin-import/blob/main/src/rules/no-restricted-paths.js
  const fullFilename = context.getPhysicalFilename
    ? context.getPhysicalFilename()
    : context.getFilename();

  const filename = fullFilename
    .replace(cwd, '')
    .split('/')
    .filter(Boolean)
    .join('/');

  if (isExempt(filename)) {
    return {};
  }

  const matchingRules = rules.filter(({importTo}) => match(filename, importTo));

  if (matchingRules.length !== 1) {
    report({
      loc: {
        start: {
          line: 1,
          column: 0,
        },
        end: {
          line: 1,
          column: 5,
        },
      },
      messageId: 'expectedOneRule',
      data: {
        filename,
        matchingRules: JSON.stringify(matchingRules),
      },
    });
    return {};
  }

  const [rule] = matchingRules;
  const {canImportFrom} = rule;

  return {
    ImportDeclaration(node) {
      const imported = node.source.value;
      const isAllowed = canImportFrom.some((target) => match(imported, target));
      if (!isAllowed) {
        report({
          node,
          messageId: 'importNotAllowed',
          data: {
            importingTo: rule.importTo,
            allowedFolders: JSON.stringify(canImportFrom),
          },
        });
      }
    },
  };
}

function match(s, target) {
  if (typeof target === RegExp) {
    return target.match(s);
  } else if (typeof target === 'string') {
    if (target.endsWith('*')) {
      return s.startsWith(target.slice(0, target.length - 1));
    } else {
      return target === s;
    }
  }
}

function isExempt(filename) {
  return ['.eslintrc.js'].includes(filename);
}
