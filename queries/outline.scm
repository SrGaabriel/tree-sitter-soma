(data_type_declaration
    (data) @context
    name: (type_name) @name
) @item

(constructor_declaration
    name: (constructor_name) @name
) @item

(struct_declaration
    "struct" @context
    name: (type_name) @name
) @item

(field_declaration
    name: (identifier) @name
) @item

(instance_declaration
    (instance) @context
    instance_type: (qualified_type) @name
) @item

(function_declaration
    (def) @context
    name: (_) @name
) @item

(trait_declaration
    (trait) @context
    type: (_) @name
) @item

(trait_function_signature
    (def) @context
    name: (_) @name
) @item

(intrinsic_data_type
    (intrinsic) @context
    name: (_) @name
) @item

(intrinsic_function
    (intrinsic) @context
    (function_signature
        (def) @context
        name: (_) @name
    )
) @item