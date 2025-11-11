const PREC = {
  apply: 2,
  infix: 1,
  arrow: 0,
};

module.exports = grammar({
  name: "soma",

  externals: ($) => [
    $._layout_start,
    $._layout_separator,
    $._layout_end,
    $.operator,
    $.def,
    $.equal,
    $.colon_colon,
    $.arrow,
    $.bar,
    $.double_arrow,
    $.colon,
    $.if,
    $.then,
    $.else,
    $.let,
    $.in,
    $.compose,
    $.bind,
    $.true,
    $.false,
    $.where,
  ],

  extras: ($) => [$.comment, /[ \t\r\f]+/],

  word: ($) => $.identifier,

  rules: {
    source_file: ($) =>
      seq(
        optional($._layout_separator),
        optional(
          seq(
            $._top_level_declaration,
            repeat(seq($._layout_separator, $._top_level_declaration)),
          ),
        ),
        optional($._layout_separator),
      ),

    comment: ($) => token("//.*"),

    _block_expression: ($) =>
      seq($._layout_start, $._expression, $._layout_end),

    _definition_rhs: ($) => choice($._expression, $._block_expression),

    _top_level_declaration: ($) => choice($.function_declaration),

    identifier: ($) => /[a-z_][a-zA-Z0-9_']*/,

    type_name: ($) => /[A-Z][a-zA-Z0-9_']*/,
    constructor_name: ($) => /[A-Z][a-zA-Z0-9_']*/,

    integer_literal: ($) => /\d+/,

    string_literal: ($) => /"([^"\\]|\\.)*"/,

    bool_literal: ($) => choice($.true, $.false),

    list_literal: ($) => seq("[", commaSep($._expression), "]"),

    _literal: ($) =>
      choice(
        $.integer_literal,
        $.string_literal,
        $.bool_literal,
        $.list_literal,
      ),

    kind: ($) => sepBy1($.arrow, "*"),

    field_declaration: ($) =>
      seq(field("name", $.identifier), $.colon_colon, field("type", $._type)),

    function_declaration: ($) =>
      seq(
        $.def,
        field("name", choice($.identifier, $.operator)),
        optional(field("parameters", $.parameter_list)),
        optional(
          choice(
            seq($.colon_colon, field("type_signature", $._type)),
            seq($.arrow, field("return_type", $._type)),
          ),
        ),
        optional(field("constraints", $.where_clause)),
        $._function_body,
      ),

    parameter_list: ($) => seq("(", commaSep1($.typed_parameter), ")"),

    typed_parameter: ($) =>
      seq(field("name", $.identifier), $.colon, field("type", $._type)),

    _function_body: ($) =>
      choice(
        seq($.equal, field("body", $._definition_rhs)),
        field("body", $.pattern_matching_body),
      ),

    where_clause: ($) => seq($.where, commaSep1($.trait_constraint)),

    trait_constraint: ($) =>
      seq(
        field("parameter", $.identifier),
        $.colon,
        field("trait", $.type_name),
      ),

    pattern_matching_body: ($) => statement_layout($, $.match_arm),

    match_arm: ($) =>
      seq(
        $.bar,
        field("patterns", repeat1($._pattern)),
        $.double_arrow,
        field("body", $._expression),
      ),

    _expression: ($) =>
      choice(
        $.let_expression,
        $.compose_block,
        $.if_expression,
        $.lambda_expression,
        $.infix_expression,
      ),

    _primary_expression: ($) =>
      choice(
        $.identifier,
        $.constructor_name,
        $._literal,
        $.parenthesized_expression,
        $.wildcard,
      ),

    app_expression: ($) =>
      seq(
        field("function", $._primary_expression),
        field("arguments", repeat($._primary_expression)),
      ),

    infix_expression: ($) =>
      seq($.app_expression, repeat(seq($.operator, $.app_expression))),

    parenthesized_expression: ($) => seq("(", $._expression, ")"),

    wildcard: ($) => "_",

    _apply_expression: ($) =>
      choice(
        $._primary_expression,
        prec.left(
          PREC.apply,
          seq(
            field("function", $._apply_expression),
            field("argument", $._primary_expression),
          ),
        ),
      ),

    lambda_expression: ($) =>
      seq(
        "\\",
        field("parameters", repeat1($._pattern)),
        $.arrow,
        field("body", $._expression),
      ),

    if_expression: ($) =>
      seq(
        $.if,
        field("condition", $._expression),
        $.then,
        field("consequence", $._expression),
        $.else,
        field("alternative", $._expression),
      ),

    let_expression: ($) =>
      seq(
        $.let,
        field("pattern", $._pattern),
        $.equal,
        field("value", $._expression),
        $.in,
        field("body", $._definition_rhs),
      ),

    compose_block: ($) =>
      seq($.compose, statement_layout($, $._compose_statement)),

    _compose_statement: ($) =>
      choice($.bind_statement, $.let_statement, $._expression),

    bind_statement: ($) =>
      seq(
        $.bind,
        field("pattern", $._pattern),
        "<-",
        field("value", $._expression),
      ),

    let_statement: ($) =>
      seq(
        $.let,
        field("pattern", $._pattern),
        $.equal,
        field("value", $._definition_rhs),
      ),

    _pattern: ($) =>
      choice(
        $.identifier,
        $._literal,
        $.constructor_pattern,
        $.parenthesized_pattern,
        $.wildcard,
      ),

    constructor_pattern: ($) =>
      seq(
        "(",
        field("constructor", $.type_name),
        field("fields", repeat1($._pattern)),
        ")",
      ),

    parenthesized_pattern: ($) => seq("(", $._pattern, ")"),

    _type: ($) =>
      choice(
        $.type_name,
        $.identifier,
        $.list_type,
        $.function_type,
        $.parenthesized_type,
      ),

    list_type: ($) => seq("[", field("element", $._type), "]"),

    function_type: ($) =>
      prec.right(
        PREC.arrow,
        seq(field("parameter", $._type), $.arrow, field("return", $._type)),
      ),

    parenthesized_type: ($) => seq("(", $._type, ")"),
  },
});

function statement_layout($, rule) {
  return seq(
    $._layout_start,
    sepBy1($._layout_separator, rule),
    optional($._layout_separator),
    $._layout_end,
  );
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

function commaSep(rule) {
  return optional(commaSep1(rule));
}

function sepBy1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)));
}
