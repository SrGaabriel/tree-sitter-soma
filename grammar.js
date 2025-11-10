const PREC = {
    apply: 2,
    infix: 1,
    arrow: 0,
};

module.exports = grammar({
    name: 'soma',

    extras: $ => [
        $.comment,
        /[ \t]/  // Only horizontal whitespace as extras
    ],

    externals: $ => [
        $._newline,
        $._indent,
        $._dedent,
        $._error_sentinel,
    ],

    word: $ => $.identifier,

    rules: {
        source_file: $ => repeat($._top_level_declaration),

        comment: $ => token(seq('//', /.*/)),

        _top_level_declaration: $ => choice(
            $.use_statement,
            $.intrinsic_declaration,
            $.data_declaration,
            $.trait_declaration,
            $.instance_declaration,
            $.function_declaration,
            $._newline
        ),

        // Identifiers and operators
        identifier: $ => /[a-z_][a-zA-Z0-9_']*/,
        type_name: $ => /[A-Z][a-zA-Z0-9_']*/,
        operator: $ => /[+\-*\/<>=!&|]+/,

        // Literals
        integer_literal: $ => /\d+/,
        string_literal: $ => /"([^"\\]|\\.)*"/,
        bool_literal: $ => choice('true', 'false'),
        list_literal: $ => seq('[', commaSep($._expression), ']'),

        _literal: $ => choice(
            $.integer_literal,
            $.string_literal,
            $.bool_literal,
            $.list_literal
        ),

        // Use statement
        use_statement: $ => seq(
            'use',
            field('module', choice($.identifier, $.type_name)),
            optional(seq(
                '.{',
                commaSep1(field('imports', choice($.identifier, $.type_name, $.operator))),
                '}'
            )),
        ),

        // Intrinsic declaration
        intrinsic_declaration: $ => seq(
            'intrinsic',
            choice(
                seq('data', $.type_name, '::', $.kind),
                seq('def', choice($.identifier, $.operator), '::', $._type, optional($.where_clause))
            )
        ),

        kind: $ => sepBy1('->', '*'),

        // Data declaration
        data_declaration: $ => seq(
            'data',
            field('name', $.type_name),
            field('parameters', repeat($.identifier)),
            optional(choice(
                seq('=', sepBy1('|', $.constructor_declaration_simple)),
                statement_layout($, $.constructor_declaration_full)
            ))
        ),

        constructor_declaration_simple: $ => $.type_name,

        constructor_declaration_full: $ => seq(
            optional('|'),
            field('name', $.type_name),
            optional(statement_layout($, $.field_declaration))
        ),

        field_declaration: $ => seq(
            field('name', $.identifier),
            '::',
            field('type', $._type)
        ),

        // Trait declaration
        trait_declaration: $ => seq(
            'trait',
            field('name', $.type_name),
            field('parameters', repeat($.identifier)),
            'where',
            statement_layout($, $.function_signature_declaration)
        ),

        function_signature_declaration: $ => seq(
            'def',
            field('name', choice($.identifier, $.operator)),
            '::',
            field('type', $._type),
            optional(field('constraints', $.where_clause))
        ),

        // Instance declaration
        instance_declaration: $ => seq(
            'instance',
            field('trait', $.type_name),
            field('types', repeat($._type)),
            'where',
            statement_layout($, $.instance_function)
        ),

        instance_function: $ => seq(
            'def',
            field('name', choice($.identifier, $.operator)),
            optional(field('parameters', $.parameter_list)),
            optional(seq('::', field('return_type', $._type))),
            optional(field('constraints', $.where_clause)),
            $._function_body
        ),

        // Function declaration
        function_declaration: $ => seq(
            'def',
            field('name', choice($.identifier, $.operator)),
            optional(field('parameters', $.parameter_list)),
            optional(choice(
                seq('::', field('type_signature', $._type)),
                seq('->', field('return_type', $._type))
            )),
            optional(field('constraints', $.where_clause)),
            $._function_body
        ),

        parameter_list: $ => seq(
            '(',
            commaSep1($.typed_parameter),
            ')'
        ),

        typed_parameter: $ => seq(
            field('name', $.identifier),
            ':',
            field('type', $._type)
        ),

        _function_body: $ => choice(
            seq('=', field('body', $._expression)),
            field('body', $.pattern_matching_body)
        ),

        where_clause: $ => seq('where', commaSep1($.trait_constraint)),
        trait_constraint: $ => seq(
            field('parameter', $.identifier),
            ':',
            field('trait', $.type_name)
        ),

        pattern_matching_body: $ => statement_layout($, $.match_arm),

        match_arm: $ => seq(
            '|',
            field('patterns', repeat1($._pattern)),
            '=>',
            field('body', $._expression)
        ),

        // Expressions
        _expression: $ => choice(
            $.let_expression,
            $.compose_block,
            $.if_expression,
            $.lambda_expression,
            $.binary_expression,
            $.function_application,
            $._primary_expression
        ),

        _primary_expression: $ => choice(
            $.identifier,
            $.type_name,
            $._literal,
            $.parenthesized_expression,
            $.wildcard
        ),

        parenthesized_expression: $ => seq('(', $._expression, ')'),
        wildcard: $ => '_',

        function_application: $ => prec.left(PREC.apply, seq(
            field('function', $._primary_expression),
            field('arguments', repeat1($._primary_expression))
        )),

        binary_expression: $ => prec.left(PREC.infix, seq(
            field('left', $._expression),
            field('operator', $.operator),
            field('right', $._expression)
        )),

        lambda_expression: $ => seq(
            '\\',
            field('parameters', repeat1($._pattern)),
            '->',
            field('body', $._expression)
        ),

        if_expression: $ => seq(
            'if',
            field('condition', $._expression),
            'then',
            field('consequence', $._expression),
            'else',
            field('alternative', $._expression)
        ),

        let_expression: $ => seq(
            'let',
            field('pattern', $._pattern),
            '=',
            field('value', $._expression),
            'in',
            field('body', $._expression)
        ),

        compose_block: $ => seq(
            'compose',
            statement_layout($, $._compose_statement)
        ),

        _compose_statement: $ => choice(
            $.bind_statement,
            $.let_statement,
            $._expression
        ),

        bind_statement: $ => seq(
            'bind',
            field('pattern', $._pattern),
            '<-',
            field('value', $._expression)
        ),

        let_statement: $ => seq(
            'let',
            field('pattern', $._pattern),
            '=',
            field('value', $._expression)
        ),

        // Patterns
        _pattern: $ => choice(
            $.identifier,
            $._literal,
            $.constructor_pattern,
            $.parenthesized_pattern,
            $.wildcard
        ),

        constructor_pattern: $ => seq(
            '(',
            field('constructor', $.type_name),
            field('fields', repeat1($._pattern)),
            ')'
        ),

        parenthesized_pattern: $ => seq('(', $._pattern, ')'),

        // Types
        _type: $ => choice(
            $.type_name,
            $.identifier,
            $.list_type,
            $.function_type,
            $.parenthesized_type
        ),

        list_type: $ => seq('[', field('element', $._type), ']'),

        function_type: $ => prec.right(PREC.arrow, seq(
            field('parameter', $._type),
            '->',
            field('return', $._type)
        )),

        parenthesized_type: $ => seq('(', $._type, ')'),
    }
});

function statement_layout($, rule) {
    return seq(
        $._indent,
        sepBy1($._newline, rule),
        optional($._newline),
        $._dedent
    );
}

function commaSep1(rule) {
    return seq(rule, repeat(seq(',', rule)));
}

function commaSep(rule) {
    return optional(commaSep1(rule));
}

function sepBy1(sep, rule) {
    return seq(rule, repeat(seq(sep, rule)));
}