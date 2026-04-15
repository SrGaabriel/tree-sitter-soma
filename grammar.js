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
    $.colon_equal,
    $._variant_open,
    $._variant_close,
  ],
  conflicts: ($) => [
    [$._pattern, $._simple_pattern],
  ],
  extras: ($) => [$.comment, /[ \n\t\r\f]+/],
  word: ($) => $.identifier,
  rules: {
    source_file: ($) => repeat($._top_level_declaration),

    data_type_declaration: ($) =>
      seq(
        optional($.attribute),
        "inductive",
        field("name", $.constructor_name),
        repeat($.binder),
        optional(seq($.colon, field("index_type", $.type))),
        "where",
        statement_layout($, $.constructor_declaration),
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

    trait_method_signature: ($) =>
      seq(
        field("name", choice($.identifier, $.operator)),
        $.colon,
        field("type_signature", $.type),
      ),
    trait_declaration: ($) =>
      seq(
        "class",
        field("name", $.constructor_name),
        repeat($.binder),
        "where",
        statement_layout($, choice(
          alias($.trait_method_signature, $.trait_function_signature),
          alias($.function_declaration, $.trait_function_signature),
        )),
      ),

    instance_declaration: ($) =>
      seq(
        "instance",
        optional(field("name", $.identifier)),
        $.colon,
        field("instance_type", $.type),
        "where",
        statement_layout($, $._top_level_declaration),
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
        repeat($.binder),
        optional(seq(choice($.colon, $.colon_colon), field("type", $.type))),
      ),
    quantity: ($) => choice($.integer_literal, "ω"),
    binder: ($) =>
      choice(
        seq("(", optional(field("quantity", $.quantity)), field("name", $.identifier), ":", field("type", $.type), ")"),
        seq("{", optional(field("quantity", $.quantity)), field("name", $.identifier), ":", field("type", $.type), "}"),
        seq(
          "{{",
          optional(field("quantity", $.quantity)),
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
        $.colon_equal,
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
      seq($.constructor_name, repeat1(seq($.colon_colon, $.constructor_name))),
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
        optional(seq($.colon, field("return_type", $.type))),
        optional(choice(
          field("body", $.pattern_matching_body),
          seq(
            $.colon_equal,
            field("body", choice($._expression, $._block_expression)),
          ),
        )),
      ),

    pattern_matching_body: ($) => statement_layout($, $.match_arm),
    match_arm: ($) =>
      seq(
        $.bar,
        field("patterns", commaSep1($._pattern)),
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
        $.app_expression,
        $._primary_expression,
      ),
    _symbol: ($) => choice($.identifier, $.operator, $.constructor_name),
    label_reference: ($) => seq("@", field("name", $.identifier)),
    _primary_expression: ($) =>
      choice(
        $.field_access_expression,
        $.identifier,
        $.qualified_constructor_name,
        $.constructor_name,
        $._literal,
        $.parenthesized_expression,
        $.wildcard,
        $.record_expression,
        $.variant_injection,
        $.label_reference,
      ),
    app_expression: ($) =>
      prec.left(PREC.apply,
        seq(
          field("function", $._primary_expression),
          field("arguments", repeat1($._primary_expression)),
        ),
      ),
    infix_expression: ($) =>
      prec.left(PREC.infix,
        seq(
          choice($.app_expression, $._primary_expression),
          repeat1(seq($.operator, choice($.app_expression, $._primary_expression))),
        ),
      ),
    parenthesized_expression: ($) => seq("(", commaSep($._expression), ")"),
    wildcard: ($) => "_",
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
        $.colon_equal,
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
        $.colon_equal,
        field("value", $._definition_rhs),
      ),
    _pattern: ($) =>
      choice(
        $.identifier,
        $._literal,
        $.qualified_constructor_name,
        $.constructor_name,
        $.constructor_app_pattern,
        $.constructor_pattern,
        $.parenthesized_pattern,
        $.wildcard,
        $.variant_pattern,
      ),
    constructor_app_pattern: ($) =>
      prec.left(1, seq(
        field("constructor", choice($.qualified_constructor_name, $.constructor_name)),
        field("fields", repeat1($._simple_pattern)),
      )),
    _simple_pattern: ($) =>
      choice(
        $.identifier,
        $._literal,
        $.qualified_constructor_name,
        $.constructor_name,
        $.parenthesized_pattern,
        $.wildcard,
      ),
    constructor_pattern: ($) =>
      prec(1,
        seq(
          "(",
          field("constructor", choice($.qualified_constructor_name, $.constructor_name)),
          field("fields", repeat($._pattern)),
          ")",
        ),
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
      seq(field("name", $.identifier), $.colon_equal, field("value", $._expression)),
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

    variant_injection: ($) =>
      seq($.dot, field("constructor", $.constructor_name)),

    simple_type: ($) =>
      choice(
        $.qualified_constructor_name,
        $.constructor_name,
        $.identifier,
        seq("[", field("element", $.type), "]"),
        seq("(", choice($.type, commaSep($.type)), ")"),
        $.row_type,
        $.variant_type,
        seq("{{", field("type", $.type), "}}"),
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

    variant_field: ($) =>
      seq(field("name", $.constructor_name), $.colon_colon, field("type", $.type)),
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
          field("arguments", repeat1($.simple_type)),
        ),
      ),
    arrow_type: ($) =>
      prec.right(
        PREC.arrow,
        seq(
          field("parameter", choice($.application_type, $.simple_type)),
          $.arrow,
          field("return", $.type),
        ),
      ),
    forall_type: ($) =>
      seq(
        $.forall,
        repeat1(choice($.binder, field("type_var", $.identifier))),
        $.dot,
        field("body", $.type),
      ),
    pi_type: ($) =>
      prec.right(
        PREC.arrow,
        seq(
          field("binder", $.binder),
          $.arrow,
          field("return", $.type),
        ),
      ),
    type: ($) =>
      choice(
        $.forall_type,
        $.pi_type,
        $.arrow_type,
        $.application_type,
        $.simple_type,
      ),
    attribute: ($) => seq("@", "[", repeat1(choice($.identifier, $.string_literal)), "]"),
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
