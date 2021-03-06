/*
parseQuery(query) => expression

Transform a query:
{
  "movies=>actionMovies": {
    "()": {"genre": "action"},
    "reverse=>": [
      {
        "title": true,
        "year": true
      }
    ]
  }
}

Into an expression that is easier to execute by the runtime:
{
  "sourceKey": "",
  "nestedExpressions": {
    "actionMovies": {
      "sourceKey": "movies",
      "params": {"genre": "action"},
      "nextExpression": {
        "sourceKey": "reverse",
        "useCollectionElements": true,
        "nestedExpressions": {
          "title": {
            "sourceKey": "title"
          },
          "year": {
            "sourceKey": "year"
          }
        }
      }
    }
  }
}
*/

export function parseQuery(query, {ignoreKeys = []} = {}) {
  if (query === undefined) {
    throw new Error(`'query' parameter is missing`);
  }

  if (!Array.isArray(ignoreKeys)) {
    ignoreKeys = [ignoreKeys];
  }

  return _parseQuery(query, {}, {ignoreKeys});
}

function _parseQuery(query, {sourceKey = '', isOptional}, {ignoreKeys}) {
  if (query === undefined) {
    throw new Error(`'query' parameter is missing`);
  }

  const expression = {sourceKey, isOptional};

  if (Array.isArray(query)) {
    if (query.length !== 1) {
      throw new Error('An array should contain exactly one item');
    }
    expression.useCollectionElements = true;
    query = query[0];
  }

  if (query === true) {
    return expression;
  }

  if (typeof query !== 'object' || query === null) {
    throw new Error(`Invalid query found: ${JSON.stringify(query)}`);
  }

  const nestedExpressions = {};
  let nextExpression;

  for (const [key, value] of Object.entries(query)) {
    if (key === '()') {
      expression.params = value;
      continue;
    }

    const {sourceKey, targetKey, isOptional} = parseKey(key);

    if (testKey(sourceKey, ignoreKeys)) {
      continue;
    }

    const subexpression = _parseQuery(value, {sourceKey, isOptional}, {ignoreKeys});

    if (targetKey) {
      nestedExpressions[targetKey] = subexpression;
    } else {
      if (nextExpression) {
        throw new Error('Multiple empty targets found at the same level');
      }
      nextExpression = subexpression;
    }
  }

  if (Object.keys(nestedExpressions).length && nextExpression) {
    throw new Error('Empty and non-empty targets found at the same level');
  }

  expression.nestedExpressions = nestedExpressions;
  expression.nextExpression = nextExpression;

  return expression;
}

function parseKey(key) {
  let sourceKey;
  let targetKey;
  let isOptional;

  const parts = key.split('=>');

  if (parts.length === 1) {
    sourceKey = parts[0];
    ({sourceKey, isOptional} = parseSourceKey(sourceKey));
    targetKey = sourceKey;
  } else if (parts.length === 2) {
    sourceKey = parts[0];
    ({sourceKey, isOptional} = parseSourceKey(sourceKey));
    targetKey = parts[1];
  } else {
    throw new Error(`Invalid key found: '${key}'`);
  }

  return {sourceKey, targetKey, isOptional};
}

function parseSourceKey(sourceKey) {
  let isOptional;
  if (sourceKey.endsWith('?')) {
    isOptional = true;
    sourceKey = sourceKey.slice(0, -1);
  }
  return {sourceKey, isOptional};
}

function testKey(key, patterns) {
  return patterns.some(pattern =>
    typeof pattern === 'string' ? pattern === key : pattern.test(key)
  );
}
