[
  "if"
  "then"
  "else"
  "let"
  "in"
  "compose"
  "bind"
  "where"
  "def"
  "class"
  "record"
  "inductive"
  "instance"
  "use"
  "pub"
  "alias"
] @keyword

(comment) @comment

(string_literal) @string
(integer_literal) @number
(bool_literal) @boolean
(list_literal) @punctuation.bracket

(function_declaration
  name: (_) @function
)

(trait_function_signature
  name: (_) @function
)

(constructor_pattern
  constructor: (qualified_constructor_name) @constructor
)

; Field and property names
(field_declaration
    name: (identifier) @property
)
(row_field
    name: (identifier) @property
)
(record_field_assignment
    name: (identifier) @property
)
(field_access_expression
    field: (identifier) @property
)

(import_path
  (identifier) @module)

; Type variables (lowercase identifiers in type position, e.g. `m`, `r`, `a`)
(simple_type (identifier) @type)

[
  (arrow)
  (equal)
  (colon)
  (bar)
  (double_arrow)
  (operator)
  (reverse_arrow)
  "<-"
] @operator

(constructor_name) @constructor

; Variant type tags
(variant_field
    name: (constructor_name) @constructor
)

; Variant injection and patterns
(variant_injection
    constructor: (constructor_name) @constructor
)
(variant_pattern
    constructor: (constructor_name) @constructor
)

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

(forall) @keyword.operator

[
    (dot)
    "/"
    ","
    (colon_colon)
] @punctuation.delimiter

(attribute
    "[" @attribute
    "]" @attribute
) @attribute

(binder
    name: (identifier) @variable.parameter
)
