# Boolean Expression Compiler Grammar

The recursive-descent parser in `js/parser.js` implements this grammar. The lexer supplies the token types used by the parser.

```text
expr     -> or_expr
or_expr  -> and_expr (OR and_expr)*
and_expr -> rel_expr (AND rel_expr)*
rel_expr -> not_expr (RELOP not_expr)?
not_expr -> NOT not_expr | primary
primary  -> NUMBER | BOOL | IDENTIFIER | '(' expr ')'
```

Token notation:
- `OR` is the logical operator `||`.
- `AND` is the logical operator `&&`.
- `NOT` is the logical operator `!`.
- `RELOP` is one of `>`, `<`, `>=`, `<=`, `==`, or `!=`.

Precedence from highest to lowest: `!`, relational operators, `&&`, `||`. Parentheses group expressions. Logical AND and OR are left-associative. Relational expressions allow at most one relational operator; chained comparisons such as `a < b < c` are reported as syntax errors. Use `a < b && b < c` when two comparisons need to be combined.
