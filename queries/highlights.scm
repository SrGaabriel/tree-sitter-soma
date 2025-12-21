[
  (if)
  (then)
  (else)
  (let)
  (in)
  (compose)
  (bind)
  (where)
  (def)
  (intrinsic)
  (data)
  (trait)
  (instance)
  (import)
  (with)
  "export"
  "struct"
] @keyword

(comment) @comment

(string_literal) @string
(integer_literal) @number
(bool_literal) @boolean
(list_literal) @list

(function_declaration
  name: (_) @function
)

(function_signature
  name: (_) @function
)

(trait_function_signature
  name: (_) @function
)

(type_parameters) @type

(constructor_pattern
  constructor: (type_name) @constructor
)

(field_declaration
    name: (identifier) @property
)

(import_path
  (identifier) @module)

(simple_type) @type

(type_name) @type

[
  (arrow)
  (equal)
  (colon)
  (colon_colon)
  (bar)
  (double_arrow)
  (operator)
  (reverse_arrow)
  "<-"
] @operator

(constructor_name) @constructor

(app_expression
  function: (identifier) @function)

[
    "{"
    "}"
    "("
    ")"
    "["
    "]"
] @punctuation.bracket

"\\" @keyword.operator

[
    "."
    "/"
    ","
] @punctuation.delimiter

(attribute
    "[" @attribute
    "]" @attribute
) @attribute
(fn_parameter (identifier) @variable.parameter)

(typed_parameter
    name: (identifier) @variable.parameter
)