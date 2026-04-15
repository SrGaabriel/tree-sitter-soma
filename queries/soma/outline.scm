(data_type_declaration
    "inductive" @context
    name: (constructor_name) @name
) @item

(constructor_declaration
    name: (constructor_name) @name
) @item

(struct_declaration
    "record" @context
    name: (constructor_name) @name
) @item

(field_declaration
    name: (identifier) @name
) @item

(instance_declaration
    "instance" @context
    instance_type: (_) @name
) @item

(function_declaration
    "def" @context
    name: (_) @name
) @item

(trait_declaration
    "class" @context
    name: (constructor_name) @name
) @item

(trait_function_signature
    name: (_) @name
) @item

(alias_declaration
    "alias" @context
    name: (constructor_name) @name
) @item
