const PREC = {
  field_access: 3,
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
    $.equal,
    $.arrow,
    $.bar,
    $.double_arrow,
    $.colon,
    $.colon_colon,
    $.dot,
    $.reverse_arrow,
    $._variant_open,
    $._variant_close,
  ],
  extras: ($) => [$.comment, /[ \n\t\r\f]+/],
  word: ($) => $.identifier,
  rules: {
    source_file: ($) => repeat($._top_level_declaration),

    function_signature: ($) =>
      seq(
        "def",
        field("name", choice($.identifier, $.operator)),
        $.colon,
        field("type_signature", $.type),
      ),

    data_type_declaration: ($) =>
      seq(
        optional($.attribute),
        "inductive",
        field("name", $.constructor_name),
        repeat($.binder),
        optional(seq(":", field("index_type", $.type))),
        "where",
        statement_layout($, seq($.constructor_declaration)),
      ),
    struct_declaration: ($) =>
      seq(
        optional($.attribute),
        "record",
        field("name", $.constructor_name),
        repeat($.binder),
        "where",
        statement_layout($, $.field_declaration),
      ),

    trait_declaration: ($) =>
      seq(
        "class",
        field("type", $.application_type),
        "where",
        $._layout_start,
        repeat1(alias($.function_signature, $.trait_function_signature)),
        $._layout_end,
      ),

    instance_declaration: ($) =>
      seq(
        "instance",
        field("instance_type", $.type),
        "where",
        $._layout_start,
        repeat1($._top_level_declaration),
        $._layout_end,
      ),
    import_declaration: ($) =>
      seq(
        optional("pub"),
        "use",
        field("module", $.import_path),
        $.dot,
        choice(seq("{", commaSep1($._symbol), "}"), "*"),
      ),
    import_path: ($) => sepBy1("/", $.identifier),

    constructor_declaration: ($) =>
      seq(
        $.bar,
        field("name", $.constructor_name),
        optional(seq($.colon, field("type", $.type))),
      ),
    binder: ($) =>
      choice(
        seq("(", field("name", $.identifier), ":", field("type", $.type), ")"),
        seq("{", field("name", $.identifier), ":", field("type", $.type), "}"),
        seq(
          "{{",
          field("name", $.identifier),
          ":",
          field("type", $.type),
          "}}",
        ),
      ),

    comment: ($) =>
      token(
        choice(seq("//", /[^\n]*/), seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
      ),

    _block_expression: ($) =>
      seq($._layout_start, $._expression, $._layout_end),
    _definition_rhs: ($) => choice($._expression, $._block_expression),
    alias_declaration: ($) =>
      seq(
        "alias",
        field("name", $.constructor_name),
        repeat(field("parameter", $.identifier)),
        $.equal,
        field("type", $.type),
      ),
    _top_level_declaration: ($) =>
      choice(
        $.function_declaration,
        $.data_type_declaration,
        $.struct_declaration,
        $.trait_declaration,
        $.instance_declaration,
        $.import_declaration,
        $.alias_declaration,
      ),
    identifier: ($) => /[a-z_][a-zA-Z0-9_']*/,
    qualified_constructor_name: ($) =>
      seq($.constructor_name, repeat(seq($.colon_colon, $.constructor_name))),
    constructor_name: ($) => /[A-Z][a-zA-Z0-9_']*/,

    integer_literal: ($) => /\d+/,
    string_literal: ($) => /"([^"\\]|\\.)*"/,
    bool_literal: ($) => choice("True", "False"),
    list_literal: ($) => seq("[", commaSep($._expression), "]"),
    _literal: ($) =>
      choice(
        $.integer_literal,
        $.string_literal,
        $.bool_literal,
        $.list_literal,
      ),
    field_declaration: ($) =>
      seq(field("name", $.identifier), $.colon, field("type", $.type)),
    function_declaration: ($) =>
      seq(
        optional($.attribute),
        "def",
        field("name", choice($.identifier, $.operator)),
        repeat($.binder),
        $.colon,
        field("return_type", $.type),
        choice(
          field("body", $.pattern_matching_body),
          seq(
            $.equal,
            field("body", choice($._expression, $._block_expression)),
          ),
        ),
      ),

    _function_body: ($) =>
      choice(
        seq($.equal, field("body", $._definition_rhs)),
        field("body", $.pattern_matching_body),
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
    _symbol: ($) => choice($.identifier, $.operator, $.constructor_name),
    _primary_expression: ($) =>
      choice(
        $.field_access_expression,
        $.identifier,
        $.qualified_constructor_name,
        $._literal,
        $.parenthesized_expression,
        $.wildcard,
        $.record_expression,
        $.variant_injection,
      ),
    associative_expression: ($) =>
      choice($.app_expression, $._primary_expression),
    app_expression: ($) =>
      seq(
        field("function", $._primary_expression),
        field("arguments", repeat1($._primary_expression)),
      ),
    infix_expression: ($) =>
      seq(
        $.associative_expression,
        repeat(seq($.operator, $.associative_expression)),
      ),
    parenthesized_expression: ($) => seq("(", commaSep($._expression), ")"),
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
        "if",
        field("condition", $._expression),
        "then",
        field("consequence", $._expression),
        "else",
        field("alternative", $._expression),
      ),
    let_expression: ($) =>
      seq(
        "let",
        field("pattern", $._pattern),
        $.equal,
        field("value", $._expression),
        "in",
        field("body", $._definition_rhs),
      ),
    compose_block: ($) =>
      seq("compose", statement_layout($, $._compose_statement)),
    _compose_statement: ($) =>
      choice($.bind_statement, $.let_statement, $._expression),
    bind_statement: ($) =>
      seq(
        "bind",
        field("pattern", $._pattern),
        "<-",
        field("value", $._expression),
      ),
    let_statement: ($) =>
      seq(
        "let",
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
        $.variant_pattern,
      ),
    _simple_pattern: ($) =>
      choice(
        $.identifier,
        $._literal,
        $.parenthesized_pattern,
        $.wildcard,
      ),
    constructor_pattern: ($) =>
      seq(
        "(",
        field("constructor", $.qualified_constructor_name),
        field("fields", repeat($._pattern)),
        ")",
      ),
    parenthesized_pattern: ($) => seq("(", $._pattern, ")"),
    variant_pattern: ($) =>
      prec.left(
        seq(
          $.dot,
          field("constructor", $.constructor_name),
          field("fields", repeat($._simple_pattern)),
        ),
      ),

    record_field_assignment: ($) =>
      seq(field("name", $.identifier), $.equal, field("value", $._expression)),
    record_expression: ($) =>
      seq("{", commaSep1($.record_field_assignment), "}"),

    field_access_expression: ($) =>
      prec.left(
        PREC.field_access,
        seq(
          field("record", $._primary_expression),
          $.dot,
          field("field", $.identifier),
        ),
      ),

    // Variant injection: .Constructor
    variant_injection: ($) =>
      seq($.dot, field("constructor", $.constructor_name)),

    simple_type: ($) =>
      choice(
        $.qualified_constructor_name,
        $.identifier,
        seq("[", field("element", $.type), "]"),
        seq("(", choice($.type, commaSep($.type)), ")"),
        $.row_type,
        $.variant_type,
      ),

    row_field: ($) =>
      seq(field("name", $.identifier), $.colon, field("type", $.type)),
    row_type: ($) =>
      seq(
        "{",
        commaSep1($.row_field),
        optional(seq($.bar, field("extension", $.identifier))),
        "}",
      ),

    // Variant types: < Ok : Int32 | Err : String >
    variant_field: ($) =>
      seq(field("name", $.constructor_name), $.colon, field("type", $.type)),
    variant_type: ($) =>
      seq(
        $._variant_open,
        sepBy1($.bar, $.variant_field),
        $._variant_close,
      ),

    application_type: ($) =>
      prec.left(
        PREC.apply,
        seq(
          field("constructor", $.simple_type),
          repeat(field("argument", $.simple_type)),
        ),
      ),
    forall_type: ($) =>
      seq(
        $.forall,
        repeat1($.binder),
        $.dot,
        field("body", $.type),
      ),
    type: ($) =>
      choice(
        $.forall_type,
        prec.right(
          PREC.arrow,
          seq(
            field("parameter", $.application_type),
            optional(seq($.arrow, field("return", $.type))),
          ),
        ),
      ),
    attribute: ($) => seq("@", "[", commaSep1($.identifier), "]"),
    forall: ($) => choice("\\", "∀"),
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
