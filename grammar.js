const PREC = {
  apply: 2,
  infix: 1,
  arrow: 0,
};

module.exports = grammar({
  name: "soma",
  conflicts: ($) => [[$.constructor_declaration]],
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
    $.intrinsic,
    $.data,
    $.trait,
    $.instance,
    $.import,
    $.lbraces,
    $.rbraces,
    $.reverse_arrow
  ],
  extras: ($) => [$.comment, /[ \n\t\r\f]+/],
  word: ($) => $.identifier,
  rules: {
    source_file: ($) => repeat($._top_level_declaration),

    data: ($) => "data",
    trait: ($) => "trait",
    instance: ($) => "instance",
    intrinsic_function: ($) => seq($.intrinsic, $.function_signature),
    function_signature: ($) =>
      seq(
        $.def,
        field("name", choice($.identifier, $.operator)),
        $.colon_colon,
        field("type_signature", $.type),
      ),
    
    data_type_declaration: ($) =>
      seq(
        $.data,
        field("name", $.type_name),
        field(
          "type_parameters",
          optional(repeat1(seq(optional($._layout_separator), $.identifier))),
        ),
        optional($._layout_separator),
        $.equal,
        $.constructor_declaration,
        repeat(statement_layout($, seq($.bar, $.constructor_declaration))),
      ),

    intrinsic_data_type: ($) =>
      seq(
        $.intrinsic,
        $.data,
        field("name", $.type_name),
        $.colon_colon,
        field("kind", $.kind_declaration)
      ),
    kind_declaration: ($) => sepBy1($.arrow, "*"),

    trait_declaration: ($) =>
      seq(
        $.trait,
        field("name", $.type_name),
        field(
          "type_parameters",
          optional(repeat1(seq(optional($._layout_separator), $.identifier))),
        ),
        $.where,
        $._layout_start,
        repeat1($.function_signature),
        $._layout_end,
      ),

    instance_declaration: ($) =>
      seq(
        $.instance,
        field("trait", $.type_name),
        field(
          "type_parameters",
          optional(repeat1(seq(optional($._layout_separator), $.type_name))),
        ),
        $.where,
        $._layout_start,
        repeat1($._top_level_declaration),
        $._layout_end,
      ),

      import_declaration: ($) =>
        seq(
          $.import,
          field("module", $.import_path),
          ".",
          choice(
            seq($.lbraces, commaSep1(choice($.identifier, $.type_name)), $.rbraces),
            "*"
          )
        ),
    import_path: ($) => sepBy1("/", $.identifier),


    constructor_declaration: ($) =>
      choice(
        // Constructor with fields
        seq(
          field("name", $.constructor_name),
          field("fields", statement_layout($, $.constructor_field)),
        ),
        // Constructor without fields
        field("name", $.constructor_name),
      ),

    constructor_field: ($) => seq($.identifier, $.colon_colon, $.type),
    comment: ($) =>
      token(
        choice(
          seq('//', /[^\n]*/),
          seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/')
        )
      ),

    _block_expression: ($) =>
      seq($._layout_start, $._expression, $._layout_end),
    _definition_rhs: ($) => choice($._expression, $._block_expression),
    _top_level_declaration: ($) =>
      choice(
        $.function_declaration,
        $.intrinsic_function,
        $.data_type_declaration,
        $.trait_declaration,
        $.instance_declaration,
        $.import_declaration,
        $.intrinsic_data_type
      ),
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
      seq(field("name", $.identifier), $.colon_colon, field("type", $.type)),
    function_declaration: ($) =>
      seq(
        $.def,
        field("name", choice($.identifier, $.operator)),
        optional(field("parameters", $.parameter_list)),
        choice(
          // Pattern match
          seq(
            $.colon_colon,
            field("type_signature", $.type),
            field("body", $.pattern_matching_body),
          ),
          // Imperative
          seq(
            optional(seq($.arrow, field("return_type", $.type))),
            optional(field("constraints", $.where_clause)),
            $.equal,
            field("body", choice($._expression, $._block_expression)),
          ),
          // Constant
          seq(
            $.colon_colon,
            field("type_signature", $.type),
            $.equal,
            field("body", choice($._expression, $._block_expression))
          )
        ),
      ),
    parameter_list: ($) => seq("(", commaSep1($.fn_parameter), ")"),
    
    fn_parameter : ($) => choice(
      $.identifier,
      $.typed_parameter
    ),
    typed_parameter: ($) =>
      seq(field("name", $.identifier), $.colon, field("type", $.type)),
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
    type: ($) =>
      choice(
        $.type_name,
        $.identifier,
        $.list_type,
        $.function_type,
        $.parenthesized_type,
      ),
    list_type: ($) => seq("[", field("element", $.type), "]"),
    function_type: ($) =>
      prec.right(
        PREC.arrow,
        seq(field("parameter", $.type), $.arrow, field("return", $.type)),
      ),
    parenthesized_type: ($) => seq("(", $.type, ")"),
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
