import { TT } from "./lexer.js";

/*
 * Recursive-descent syntax analyzer for the Boolean Expression Compiler.
 *
 * Grammar implemented (operator precedence: !, relational, &&, ||):
 *   expr     -> or_expr
 *   or_expr  -> and_expr (LOGOP_OR and_expr)*
 *   and_expr -> rel_expr (LOGOP_AND rel_expr)*
 *   rel_expr -> not_expr (RELOP not_expr)?
 *   not_expr -> NOT not_expr | primary
 *   primary  -> NUMBER | BOOL | IDENTIFIER | LPAREN expr RPAREN
 *
 * Relational expressions allow at most one relational operator. This avoids
 * silently interpreting a chained comparison such as a < b < c as (a < b) < c.
 *
 * Public interface preserved for main.js:
 *   new Parser(tokens).parse() -> ASTNode
 *   parser.errors -> ParseError[]
 *   ASTNode(kind, value, left, right)
 */

class ParseError {
  constructor(msg, pos) {
    this.msg = msg;
    this.pos = Number.isFinite(pos) ? pos : 0;
  }
}

class ASTNode {
  constructor(kind, value, left = null, right = null) {
    this.kind = kind;
    this.value = value;
    this.left = left;
    this.right = right;
  }
}

class Parser {
  constructor(tokens = []) {
    this.tokens = Array.isArray(tokens) ? tokens : [];
    this.pos = 0;
    this.errors = [];
    this.fallbackEOF = {
      type: TT.EOF,
      value: "EOF",
      pos: this.tokens.length ? (this.tokens[this.tokens.length - 1].pos ?? 0) : 0
    };
  }

  peek(offset = 0) {
    return this.tokens[this.pos + offset] || this.fallbackEOF;
  }

  consume() {
    const token = this.peek();
    // Never advance beyond EOF; it keeps error recovery safe.
    if (token.type !== TT.EOF && this.pos < this.tokens.length) this.pos++;
    return token;
  }

  addError(message, token = this.peek()) {
    const pos = token && Number.isFinite(token.pos) ? token.pos : 0;
    // Avoid repeating the same message at the same source position.
    if (!this.errors.some(error => error.pos === pos && error.msg === message)) {
      this.errors.push(new ParseError(message, pos));
    }
  }

  parse() {
    if (this.peek().type === TT.EOF) {
      this.addError("Expression is empty; enter a Boolean expression.");
      return new ASTNode("ERROR", "empty");
    }

    let node;
    try {
      node = this.parseOr();
    } catch (error) {
      // Defensive fallback: malformed token streams should not crash the UI.
      this.addError(`Unable to parse expression: ${error.message}`);
      node = new ASTNode("ERROR", "?");
    }

    if (this.peek().type !== TT.EOF) {
      const token = this.peek();
      this.addError(`Unexpected token '${token.value}' after expression`, token);
      // Consume remaining tokens only for recovery; preserve the first useful
      // trailing-token error rather than looping on an unexpected token.
      while (this.peek().type !== TT.EOF) this.consume();
    }

    return node || new ASTNode("ERROR", "?");
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.peek().type === TT.LOGOP && this.peek().value === "||") {
      const operator = this.consume();
      const right = this.parseAnd();
      left = new ASTNode("LOGOP", operator.value, left, right);
    }
    return left;
  }

  parseAnd() {
    let left = this.parseRel();
    while (this.peek().type === TT.LOGOP && this.peek().value === "&&") {
      const operator = this.consume();
      const right = this.parseRel();
      left = new ASTNode("LOGOP", operator.value, left, right);
    }
    return left;
  }

  parseRel() {
    let left = this.parseNot();
    if (this.peek().type === TT.RELOP) {
      const operator = this.consume();
      const right = this.parseNot();
      left = new ASTNode("RELOP", operator.value, left, right);

      // Chained relational comparisons are deliberately rejected by the CFG.
      if (this.peek().type === TT.RELOP) {
        const next = this.peek();
        this.addError(
          "Chained relational operators are not supported; combine comparisons with && or use parentheses.",
          next
        );
        // Continue consuming into an AST so the UI can still display a useful
        // partial tree, while parser.errors marks the expression invalid.
        while (this.peek().type === TT.RELOP) {
          const nextOperator = this.consume();
          const nextRight = this.parseNot();
          left = new ASTNode("RELOP", nextOperator.value, left, nextRight);
        }
      }
    }
    return left;
  }

  parseNot() {
    if (this.peek().type === TT.NOT) {
      const operator = this.consume();
      const operand = this.parseNot();
      return new ASTNode("NOT", operator.value, operand, null);
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const token = this.peek();

    if (token.type === TT.NUMBER) {
      this.consume();
      return new ASTNode("NUMBER", token.value);
    }
    if (token.type === TT.BOOL) {
      this.consume();
      return new ASTNode("BOOL", token.value);
    }
    if (token.type === TT.IDENTIFIER) {
      this.consume();
      return new ASTNode("IDENT", token.value);
    }
    if (token.type === TT.LPAREN) {
      const opening = this.consume();
      if (this.peek().type === TT.RPAREN) {
        this.addError("Empty parentheses are not a valid expression.", this.peek());
        this.consume();
        return new ASTNode("ERROR", "()");
      }

      const inner = this.parseOr();
      if (this.peek().type === TT.RPAREN) {
        this.consume();
      } else {
        this.addError("Missing closing ')' for '('", opening);
      }
      return inner;
    }
    if (token.type === TT.EOF) {
      this.addError("Unexpected end of expression; an operand was expected.", token);
      return new ASTNode("ERROR", "?");
    }
    if (token.type === TT.RPAREN) {
      this.addError("Unexpected ')' where an operand was expected.", token);
      // Leave ')' for the enclosing parenthesized expression to consume.
      return new ASTNode("ERROR", token.value);
    }

    this.addError(`Unexpected token '${token.value}'; an operand was expected.`, token);
    this.consume();
    return new ASTNode("ERROR", token.value);
  }
}

export { Parser, ASTNode, ParseError };
