
/* ==============================================================
   LEXER
   ============================================================== */

const TT = {
  NUMBER: 'NUMBER',
  IDENTIFIER: 'IDENTIFIER',
  BOOL: 'BOOL',
  RELOP: 'RELOP',
  LOGOP: 'LOGOP',
  NOT: 'NOT',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  EOF: 'EOF',
  UNKNOWN: 'UNKNOWN'
};

class Token {
  constructor(type, value, pos) {
    this.type = type;
    this.value = value;
    this.pos = pos;
  }
}

class LexError {
  constructor(msg, pos) {
    this.msg = msg;
    this.pos = pos;
  }
}

function lex(src) {
  const tokens = [];
  const errors = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    // Ignore whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    const start = i;
    const two = src.slice(i, i + 2);

    // Multi-character operators must be checked first
    if (['&&', '||'].includes(two)) {
      tokens.push(new Token(TT.LOGOP, two, i));
      i += 2;
      continue;
    }

    if (['==', '!=', '>=', '<='].includes(two)) {
      tokens.push(new Token(TT.RELOP, two, i));
      i += 2;
      continue;
    }

    // Single-character operators and parentheses
    if (ch === '!') {
      tokens.push(new Token(TT.NOT, ch, i++));
      continue;
    }

    if (['>', '<'].includes(ch)) {
      tokens.push(new Token(TT.RELOP, ch, i++));
      continue;
    }

    if (ch === '(') {
      tokens.push(new Token(TT.LPAREN, ch, i++));
      continue;
    }

    if (ch === ')') {
      tokens.push(new Token(TT.RPAREN, ch, i++));
      continue;
    }

    // Numbers: integers and decimals
    if (/\d/.test(ch)) {
      while (i < src.length && /\d/.test(src[i])) {
        i++;
      }

      if (src[i] === '.') {
        i++;

        if (i >= src.length || !/\d/.test(src[i])) {
          while (i < src.length && /[\w.]/.test(src[i])) {
            i++;
          }

          errors.push(
            new LexError(
              `Malformed number '${src.slice(start, i)}'`,
              start
            )
          );
          continue;
        }

        while (i < src.length && /\d/.test(src[i])) {
          i++;
        }
      }

      // Detect additional decimal points or identifier characters
      if (i < src.length && /[.\w]/.test(src[i])) {
        while (i < src.length && /[\w.]/.test(src[i])) {
          i++;
        }

        errors.push(
          new LexError(
            `Malformed number '${src.slice(start, i)}'`,
            start
          )
        );
        continue;
      }

      tokens.push(
        new Token(TT.NUMBER, src.slice(start, i), start)
      );
      continue;
    }

    // Identifiers and Boolean literals
    if (/[a-zA-Z_]/.test(ch)) {
      i++;

      while (i < src.length && /\w/.test(src[i])) {
        i++;
      }

      const value = src.slice(start, i);
      const type =
        value === 'true' || value === 'false'
          ? TT.BOOL
          : TT.IDENTIFIER;

      tokens.push(new Token(type, value, start));
      continue;
    }

    // Unsupported character
    errors.push(
      new LexError(`Unexpected character '${ch}'`, i)
    );
    i++;
  }

  tokens.push(new Token(TT.EOF, 'EOF', src.length));

  return { tokens, errors };
}

export { TT, Token, LexError, lex };
