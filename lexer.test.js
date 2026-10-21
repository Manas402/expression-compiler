
import test from 'node:test';
import assert from 'node:assert/strict';
import { lex, TT } from './lexer.js';

test('identifiers and Boolean literals', () => {
  const { tokens, errors } = lex('x total_1 true false');

  assert.deepEqual(errors, []);
  assert.deepEqual(
    tokens.slice(0, 4).map(t => [t.type, t.value]),
    [
      [TT.IDENTIFIER, 'x'],
      [TT.IDENTIFIER, 'total_1'],
      [TT.BOOL, 'true'],
      [TT.BOOL, 'false']
    ]
  );
});

test('numbers and decimal numbers', () => {
  const { tokens, errors } = lex('10 3.14 0.5');

  assert.deepEqual(errors, []);
  assert.deepEqual(
    tokens.slice(0, 3).map(t => t.value),
    ['10', '3.14', '0.5']
  );
});

test('multi-character operators', () => {
  const { tokens, errors } = lex('&& || >= <= == !=');

  assert.deepEqual(errors, []);
  assert.deepEqual(
    tokens.slice(0, 6).map(t => t.value),
    ['&&', '||', '>=', '<=', '==', '!=']
  );
});

test('single-character operators and parentheses', () => {
  const { tokens, errors } = lex('! > < ( )');

  assert.deepEqual(errors, []);
  assert.deepEqual(
    tokens.slice(0, 5).map(t => t.type),
    [TT.NOT, TT.RELOP, TT.RELOP, TT.LPAREN, TT.RPAREN]
  );
});

test('valid Boolean expression', () => {
  const { tokens, errors } =
    lex('(age >= 18) && (active == true)');

  assert.deepEqual(errors, []);
  assert.deepEqual(
    tokens.slice(0, -1).map(t => t.value),
    ['(', 'age', '>=', '18', ')', '&&',
     '(', 'active', '==', 'true', ')']
  );
});

test('invalid characters produce errors', () => {
  const { tokens, errors } = lex('x @ y');

  assert.equal(errors.length, 1);
  assert.match(errors[0].msg, /Unexpected character/);
  assert.deepEqual(
    tokens.slice(0, -1).map(t => t.value),
    ['x', 'y']
  );
});

test('malformed decimal numbers produce errors', () => {
  for (const input of ['12.3.4', '5..2', '3.']) {
    const { errors } = lex(input);
    assert.ok(errors.length > 0, `${input} should fail`);
    assert.match(errors[0].msg, /Malformed number/);
  }
});

test('EOF token is always present', () => {
  const { tokens } = lex('x');
  assert.equal(tokens.at(-1).type, TT.EOF);
});

test('whitespace and empty input', () => {
  assert.deepEqual(lex('').errors, []);
  assert.deepEqual(lex(' \t\n ').errors, []);
});
