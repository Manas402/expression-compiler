import { TT } from "./lexer.js";

/*
 * Compatible semantic analyzer for this project's AST:
 * ASTNode(kind, value, left, right)
 * Return format intentionally matches main.js: [{status, rule, msg}]
 * No declaration UI exists, so identifiers are inferred from operator context.
 */
function analyze(ast, tokens) {
  const checks = [];
  const add = (status, rule, msg) => checks.push({ status, rule, msg });
  const real = (tokens || []).filter(t => t.type !== TT.EOF);
  const variables = new Set(real.filter(t => t.type === TT.IDENTIFIER).map(t => t.value));

  if (!real.length) {
    add('fail', 'Non-empty Expression', 'Expression is empty. Provide a Boolean expression.');
    return checks;
  }
  if (!ast || ast.kind === 'ERROR') {
    add('fail', 'Operand and Operator Structure', 'Expression could not be parsed; check missing operands, operators, and parentheses.');
    return checks;
  }

  let depth = 0, maxDepth = 0, badParen = false;
  for (const t of real) {
    if (t.type === TT.LPAREN) { depth++; maxDepth = Math.max(maxDepth, depth); }
    if (t.type === TT.RPAREN && --depth < 0) { badParen = true; break; }
  }
  add((depth !== 0 || badParen) ? 'fail' : 'pass', 'Balanced Parentheses',
      (depth !== 0 || badParen) ? 'Parentheses are unbalanced.' : `Parentheses are balanced. Max nesting depth: ${maxDepth}.`);

  let consecutive = false;
  for (let i = 0; i < real.length - 1; i++) {
    const isBinary = t => t.type === TT.RELOP || (t.type === TT.LOGOP && t.value !== '!');
    if (isBinary(real[i]) && isBinary(real[i + 1])) consecutive = true;
  }
  add(consecutive ? 'fail' : 'pass', 'Operator Usage',
      consecutive ? 'Consecutive binary operators detected. Each binary operator needs a left and right operand.'
                  : 'No consecutive binary operators detected.');

  const hasParseErrorNode = n => !n || n.kind === 'ERROR' ||
    (n.left && hasParseErrorNode(n.left)) || (n.right && hasParseErrorNode(n.right));
  if (hasParseErrorNode(ast)) {
    add('fail', 'Expression Structure', 'The expression contains a missing or invalid operand.');
    return checks;
  }
  add('pass', 'Expression Structure', 'The expression has a valid parsed structure.');

  if (variables.size) {
    const counts = {};
    for (const v of real.filter(t => t.type === TT.IDENTIFIER)) counts[v.value] = (counts[v.value] || 0) + 1;
    add('info', 'Variables Detected', `Found ${variables.size} variable(s): ${[...variables].join(', ')}.` +
      (Object.values(counts).some(n => n > 1) ? ' Repeated identifiers refer to the same variable.' : ''));
  } else {
    add('info', 'Variables Detected', 'No variables used; expression contains literals only.');
  }

  // Infer identifier types from operator context and enforce one consistent
  // type per identifier. This language has no declaration UI, so types are
  // inferred from comparisons and logical operators.
  const inferred = new Map();
  const typeErrors = [];
  function constrain(node, expected, context) {
    if (!node || !expected) return;
    if (node.kind === 'IDENT') {
      const prior = inferred.get(node.value);
      if (prior && prior !== expected) {
        typeErrors.push(`Variable '${node.value}' is used as both ${prior} and ${expected} (${context}).`);
      } else {
        inferred.set(node.value, expected);
      }
      return;
    }
    if (node.kind === 'NUMBER' && expected !== 'number') {
      typeErrors.push(`${context} requires ${expected} operands, but received a number.`);
    } else if (node.kind === 'BOOL' && expected !== 'bool') {
      typeErrors.push(`${context} requires ${expected} operands, but received a Boolean.`);
    }
  }
  function infer(n) {
    if (!n) return null;
    if (n.kind === 'NUMBER') return 'number';
    if (n.kind === 'BOOL') return 'bool';
    if (n.kind === 'IDENT') return inferred.get(n.value) || null;
    if (n.kind === 'NOT') {
      constrain(n.left, 'bool', "operand of '!'");
      infer(n.left);
      return 'bool';
    }
    if (n.kind === 'LOGOP') {
      constrain(n.left, 'bool', `operand of '${n.value}'`);
      constrain(n.right, 'bool', `operand of '${n.value}'`);
      infer(n.left); infer(n.right);
      return 'bool';
    }
    if (n.kind === 'RELOP') {
      const equality = n.value === '==' || n.value === '!=';
      const expected = equality ? null : 'number';
      if (expected) {
        constrain(n.left, expected, `operator '${n.value}'`);
        constrain(n.right, expected, `operator '${n.value}'`);
      } else {
        const lt = n.left?.kind === 'NUMBER' ? 'number' : n.left?.kind === 'BOOL' ? 'bool' : null;
        const rt = n.right?.kind === 'NUMBER' ? 'number' : n.right?.kind === 'BOOL' ? 'bool' : null;
        if (n.left?.kind === 'IDENT' && rt) constrain(n.left, rt, `operator '${n.value}'`);
        if (n.right?.kind === 'IDENT' && lt) constrain(n.right, lt, `operator '${n.value}'`);
        if (lt && rt && lt !== rt) typeErrors.push(`'${n.value}' requires operands of the same type; received ${lt} and ${rt}.`);
      }
      infer(n.left); infer(n.right);
      return 'bool';
    }
    return null;
  }
  // Iterate constraints a few times so context discovered later in the AST
  // can be propagated to repeated occurrences of the same variable.
  for (let i = 0; i < Math.max(2, variables.size + 1); i++) infer(ast);
  const uniqueErrors = [...new Set(typeErrors)];
  if (uniqueErrors.length) {
    for (const msg of uniqueErrors) add('fail', 'Type Checking', msg);
  } else {
    add('pass', 'Type Checking', 'No type conflicts detected. Variable types are inferred from their use because this UI has no declaration field.');
  }
  add('pass', 'Boolean Result', 'The expression has a Boolean expression structure.');
  const hasAnd = real.some(t => t.type === TT.LOGOP && t.value === '&&');
  const hasOr = real.some(t => t.type === TT.LOGOP && t.value === '||');
  if (hasAnd && hasOr) add('warn', 'Mixed AND/OR Precedence', 'Both && and || are used. && binds tighter than ||.');
  return checks;
}
export { analyze };
